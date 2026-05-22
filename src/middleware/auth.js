const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { getUserById } = require('../services/authService');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
      timestamp: new Date().toISOString()
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await getUserById(decoded.sub);

    if (!user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'Invalid token',
      timestamp: new Date().toISOString()
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: `Role ${req.user.role} not allowed. Required: ${allowedRoles.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

function requireEmailVerified(req, res, next) {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email first',
      timestamp: new Date().toISOString()
    });
  }
  next();
}

module.exports = {
  authenticate,
  requireRole,
  requireEmailVerified
};
