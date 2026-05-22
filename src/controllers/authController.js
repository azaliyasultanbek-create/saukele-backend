const { body, validationResult } = require('express-validator');
const {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  createEmailVerificationToken,
  verifyEmailByToken,
  verifyEmailByCode,
  createPasswordResetToken,
  resetPasswordByToken
} = require('../services/authService');
const { emailQueue } = require('../queues/emailQueue');

const validateRegister = [
  body('phone').matches(/^7[0-9]{10}$/).withMessage('Phone must be 11 digits starting with 7 (e.g., 77071234567)'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('role').optional().isIn(['couple', 'guest']).withMessage('Role must be couple or guest')
];

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      errors: errors.array(),
      timestamp: new Date().toISOString()
    });
  }

  const { phone, email, password, fullName, role } = req.body;

  try {
        const result = await registerUser({ phone, email, password, fullName, role });
        const verificationCode = await createEmailVerificationToken(result.user.id);

        console.log(`\n🔐 [EMAIL VERIFICATION CODE] for ${email}: ${verificationCode}\n`);

        await emailQueue.add('verification-email', {
          type: 'verification',
          to: email,
          data: { code: verificationCode }
        });

    return res.status(201).json({
      message: 'User registered successfully. Please verify your email.',
      user: result.user,
      verification_code: verificationCode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.message === 'USER_ALREADY_EXISTS') {
      return res.status(409).json({ code: 'USER_EXISTS', message: 'User with this phone already exists', timestamp: new Date().toISOString() });
    }
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'User with this email already exists', timestamp: new Date().toISOString() });
    }

    console.error('Registration error:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to register user', timestamp: new Date().toISOString() });
  }
}

async function login(req, res) {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Phone and password are required', timestamp: new Date().toISOString() });
  }

  try {
    const result = await loginUser(phone, password);
    return res.json({
      message: 'Login successful',
      user: result.user,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: 'bearer'
    });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password', timestamp: new Date().toISOString() });
    }
    if (error.message === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email first', timestamp: new Date().toISOString() });
    }
    console.error('Login error:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to login', timestamp: new Date().toISOString() });
  }
}

async function refresh(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Refresh token is required', timestamp: new Date().toISOString() });
  }

  try {
    const decoded = require('jsonwebtoken').verify(refresh_token, require('../config/env').jwtRefreshSecret);
    const result = await refreshAccessToken(decoded.sub, refresh_token);
    return res.json({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      token_type: 'bearer'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.message === 'INVALID_REFRESH_TOKEN') {
      return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token', timestamp: new Date().toISOString() });
    }
    if (error.message === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email first', timestamp: new Date().toISOString() });
    }
    console.error('Refresh error:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to refresh token', timestamp: new Date().toISOString() });
  }
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Email is required', timestamp: new Date().toISOString() });
  }

  try {
    const result = await createPasswordResetToken(email);

    if (result?.token) {
      await emailQueue.add('password-reset-email', {
        type: 'password-reset',
        to: email,
        data: { token: result.token }
      });
    }

    return res.json({
      message: 'If account exists, password reset email has been sent.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to process request', timestamp: new Date().toISOString() });
  }
}

async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password || password.length < 8) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Token and password(min 8 chars) are required',
      timestamp: new Date().toISOString()
    });
  }

  try {
    await resetPasswordByToken(token, password);
    return res.json({ message: 'Password reset successful', timestamp: new Date().toISOString() });
  } catch (error) {
    if (['INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_ALREADY_USED'].includes(error.message)) {
      return res.status(400).json({ code: error.message, message: 'Invalid or expired token', timestamp: new Date().toISOString() });
    }
    console.error('Reset password error:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to reset password', timestamp: new Date().toISOString() });
  }
}

async function verifyEmail(req, res) {
  const token = req.query.token;
  const { email, code } = req.body || {};

  if (!token && (!email || !code)) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Token or email and code are required', timestamp: new Date().toISOString() });
  }

  console.log(`\n🔍 [VERIFY EMAIL] email='${email}' code='${code}' token='${token}'\n`);

  try {
    if (token) {
      await verifyEmailByToken(token);
    } else {
      const normalizedEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();
      console.log(`🔍 [VERIFY EMAIL] normalized email='${normalizedEmail}' code='${cleanCode}'`);

      // Check if user exists
      const { prisma } = require('../config/database');
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (user) {
        console.log(`🔍 [VERIFY EMAIL] user found: id=${user.id}, emailVerified=${user.emailVerified}`);
      } else {
        console.log(`🔍 [VERIFY EMAIL] user NOT found for email '${normalizedEmail}'`);
      }

      await verifyEmailByCode(normalizedEmail, cleanCode);
    }
    return res.json({ message: 'Email verified successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(`🔍 [VERIFY EMAIL ERROR] message='${error.message}'`);
    if (['INVALID_TOKEN', 'INVALID_CODE', 'TOKEN_EXPIRED', 'TOKEN_ALREADY_USED'].includes(error.message)) {
      return res.status(400).json({ code: error.message, message: 'Invalid or expired token', timestamp: new Date().toISOString() });
    }
    console.error('Verify email error:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to verify email', timestamp: new Date().toISOString() });
  }
}

async function logout(req, res) {
  const userId = req.user?.id;
  if (userId) await logoutUser(userId);
  return res.json({ message: 'Logout successful', timestamp: new Date().toISOString() });
}

async function me(req, res) {
  return res.json({ user: req.user, timestamp: new Date().toISOString() });
}

module.exports = {
  validateRegister,
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyEmail
};
