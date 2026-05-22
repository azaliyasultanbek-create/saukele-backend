const express = require('express');
const { authenticate, requireRole, requireEmailVerified } = require('../middleware/auth');
const {
  createWeddingProfile,
  getWeddingProfile,
  getAllWeddings,
  updateWeddingProfile
} = require('../controllers/coupleController');

const router = express.Router();

// Public routes
router.get('/weddings', getAllWeddings);
router.get('/:coupleId', getWeddingProfile);

// Protected routes
router.post('/profile', authenticate, requireEmailVerified, requireRole('couple', 'admin'), createWeddingProfile);
router.put('/:coupleId', authenticate, requireEmailVerified, requireRole('couple', 'admin'), updateWeddingProfile);

module.exports = router;