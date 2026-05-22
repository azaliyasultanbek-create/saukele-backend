const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const env = require('../config/env');

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(userId, role) {
  return jwt.sign({ sub: userId, role, type: 'access' }, env.jwtSecret, { expiresIn: '15m' });
}

function generateRefreshToken(userId) {
  return jwt.sign(
    { sub: userId, type: 'refresh', jti: crypto.randomBytes(16).toString('hex') },
    env.jwtRefreshSecret,
    { expiresIn: '7d' }
  );
}

function getRefreshTokenExpiresAt(token) {
  const decoded = jwt.decode(token);
  if (decoded?.exp) {
    return new Date(decoded.exp * 1000);
  }

  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashEmailCode(email, code) {
  return hashToken(`${normalizeEmail(email)}:${code}`);
}

async function storeRefreshToken(token, userId) {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false
      },
      data: { isRevoked: true }
    }),
    prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt: getRefreshTokenExpiresAt(token)
      }
    })
  ]);
}

async function verifyRefreshToken(token, userId) {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token }
  });

  return Boolean(
    storedToken &&
    storedToken.userId === userId &&
    !storedToken.isRevoked &&
    storedToken.expiresAt > new Date()
  );
}

async function revokeRefreshToken(userId) {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      isRevoked: false
    },
    data: { isRevoked: true }
  });
}

async function registerUser({ phone, email, password, fullName, role = 'guest' }) {
  const normalizedEmail = email ? normalizeEmail(email) : null;
  const existingByPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingByPhone) throw new Error('USER_ALREADY_EXISTS');

  if (normalizedEmail) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingByEmail) throw new Error('EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { phone, email: normalizedEmail, passwordHash, fullName, role, emailVerified: false }
  });

  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerified
    }
  };
}

async function loginUser(phone, password) {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) throw new Error('INVALID_CREDENTIALS');

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) throw new Error('INVALID_CREDENTIALS');
  if (!user.emailVerified) throw new Error('EMAIL_NOT_VERIFIED');

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);
  await storeRefreshToken(refreshToken, user.id);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      emailVerified: user.emailVerified,
      fullName: user.fullName,
      role: user.role
    },
    accessToken,
    refreshToken
  };
}

async function createEmailVerificationToken(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) throw new Error('EMAIL_REQUIRED');

  const code = generateVerificationCode();
  const tokenHash = hashEmailCode(user.email, code);

  await prisma.userToken.updateMany({
    where: {
      userId,
      type: 'email_verification',
      usedAt: null
    },
    data: { usedAt: new Date() }
  });

  await prisma.userToken.create({
    data: {
      userId,
      tokenHash,
      type: 'email_verification',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  return code;
}

async function verifyEmailByToken(rawToken) {
  const tokenHash = hashToken(rawToken);

  const token = await prisma.userToken.findUnique({ where: { tokenHash } });
  if (!token || token.type !== 'email_verification') throw new Error('INVALID_TOKEN');
  if (token.usedAt) throw new Error('TOKEN_ALREADY_USED');
  if (token.expiresAt < new Date()) throw new Error('TOKEN_EXPIRED');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() }
    }),
    prisma.userToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() }
    })
  ]);
}

async function verifyEmailByCode(email, code) {
  const normalizedEmail = normalizeEmail(email);
  const cleanCode = String(code).trim();

  if (!/^\d{6}$/.test(cleanCode)) throw new Error('INVALID_CODE');

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw new Error('INVALID_CODE');

  const tokenHash = hashEmailCode(normalizedEmail, cleanCode);
  const token = await prisma.userToken.findUnique({ where: { tokenHash } });

  if (!token || token.type !== 'email_verification' || token.userId !== user.id) {
    throw new Error('INVALID_CODE');
  }
  if (token.usedAt) throw new Error('TOKEN_ALREADY_USED');
  if (token.expiresAt < new Date()) throw new Error('TOKEN_EXPIRED');
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() }
    }),
    prisma.userToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() }
    })
  ]);
}

async function createPasswordResetToken(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  await prisma.userToken.create({
    data: {
      userId: user.id,
      tokenHash,
      type: 'password_reset',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });

  return { token: rawToken, user };
}

async function resetPasswordByToken(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);

  const token = await prisma.userToken.findUnique({ where: { tokenHash } });
  if (!token || token.type !== 'password_reset') throw new Error('INVALID_TOKEN');
  if (token.usedAt) throw new Error('TOKEN_ALREADY_USED');
  if (token.expiresAt < new Date()) throw new Error('TOKEN_EXPIRED');

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash, emailVerified: true, emailVerifiedAt: new Date() }
    }),
    prisma.userToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() }
    })
  ]);

  await revokeRefreshToken(token.userId);
}

async function refreshAccessToken(userId, refreshToken) {
  const isValid = await verifyRefreshToken(refreshToken, userId);
  if (!isValid) throw new Error('INVALID_REFRESH_TOKEN');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (!user.emailVerified) throw new Error('EMAIL_NOT_VERIFIED');

  const newRefreshToken = generateRefreshToken(user.id);
  await storeRefreshToken(newRefreshToken, user.id);

  return {
    accessToken: generateAccessToken(user.id, user.role),
    refreshToken: newRefreshToken
  };
}

async function logoutUser(userId) {
  await revokeRefreshToken(userId);
}

async function getUserById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      email: true,
      emailVerified: true,
      fullName: true,
      role: true,
      createdAt: true
    }
  });
}

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getUserById,
  generateAccessToken,
  verifyRefreshToken,
  createEmailVerificationToken,
  verifyEmailByToken,
  verifyEmailByCode,
  createPasswordResetToken,
  resetPasswordByToken
};
