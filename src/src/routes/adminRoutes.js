const express = require('express');
const env = require('../config/env');
const { emailQueue } = require('../queues/emailQueue');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  adminGetAllWeddings,
  adminGetWeddingDetails,
  adminUpdateWedding,
  adminDeleteWedding,
  adminGetUsers,
  adminUpdateUser,
  adminGetStats
} = require('../controllers/adminController');

const router = express.Router();

function requireAdminApiKey(req, res, next) {
  const providedKey = req.headers['x-admin-api-key'];

  if (!env.adminApiKey || providedKey !== env.adminApiKey) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Invalid admin API key',
      timestamp: new Date().toISOString()
    });
  }

  next();
}

// Поддержка двух способов аутентификации:
// 1. JWT токен с ролью admin (для фронтенда)
// 2. API-ключ через x-admin-api-key (для внешних интеграций)
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-admin-api-key'];

  // Если есть API-ключ — проверяем его
  if (apiKey) {
    return requireAdminApiKey(req, res, next);
  }

  // Иначе — проверяем JWT с ролью admin
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, (err) => {
      if (err) return err;
      return requireRole('admin')(req, res, next);
    });
  }

  return res.status(401).json({
    code: 'UNAUTHORIZED',
    message: 'Authentication required. Provide Bearer token or x-admin-api-key',
    timestamp: new Date().toISOString()
  });
}

// Очереди
router.get('/queues', requireAdmin, async (req, res) => {
  const emailCounts = await emailQueue.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
    'paused'
  );

  return res.json({
    queues: {
      emails: emailCounts
    },
    timestamp: new Date().toISOString()
  });
});

// Статистика
router.get('/stats', requireAdmin, adminGetStats);

// Управление свадьбами
router.get('/weddings', requireAdmin, adminGetAllWeddings);
router.get('/weddings/:coupleId', requireAdmin, adminGetWeddingDetails);
router.put('/weddings/:coupleId', requireAdmin, adminUpdateWedding);
router.delete('/weddings/:coupleId', requireAdmin, adminDeleteWedding);

// Управление пользователями
router.get('/users', requireAdmin, adminGetUsers);
router.put('/users/:userId', requireAdmin, adminUpdateUser);

module.exports = router;
