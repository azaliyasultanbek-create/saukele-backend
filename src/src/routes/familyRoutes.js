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


router.post('/members', authenticate, requireEmailVerified, requireRole('guest', 'couple', 'admin'), addFamilyMember);
router.get('/my-kinship', authenticate, requireEmailVerified, requireRole('guest', 'couple', 'admin'), getMyKinship);
router.get('/gifts', authenticate, requireEmailVerified, requireRole('guest', 'couple', 'admin'), getGiftsByKinship);


router.get('/tree/:coupleId', authenticate, getFamilyTree);


router.post('/registry', authenticate, requireEmailVerified, requireRole('couple', 'admin'), createRegistryEntry);
router.get('/registry/:coupleId', authenticate, getRegistry);

module.exports = router;