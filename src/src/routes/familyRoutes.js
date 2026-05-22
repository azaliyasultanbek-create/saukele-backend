const express = require('express');
const { authenticate, requireRole, requireEmailVerified } = require('../middleware/auth');
const {
  addFamilyMember,
  getMyKinship,
  getFamilyTree,
  createRegistryEntry,
  getRegistry,
  getGiftsByKinship
} = require('../controllers/familyController');

const router = express.Router();

// Управление родственниками
router.post('/members', authenticate, requireEmailVerified, requireRole('guest', 'couple', 'admin'), addFamilyMember);
router.get('/my-kinship', authenticate, requireEmailVerified, requireRole('guest', 'couple', 'admin'), getMyKinship);
router.get('/gifts', authenticate, requireEmailVerified, requireRole('guest', 'couple', 'admin'), getGiftsByKinship);

// Генеалогическое древо (рекурсивный CTE)
router.get('/tree/:coupleId', authenticate, getFamilyTree);

// Реестр родства (традиционные категории)
router.post('/registry', authenticate, requireEmailVerified, requireRole('couple', 'admin'), createRegistryEntry);
router.get('/registry/:coupleId', authenticate, getRegistry);

module.exports = router;