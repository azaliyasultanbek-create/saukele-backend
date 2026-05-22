const express = require('express');
const { authenticate, requireRole, requireEmailVerified } = require('../middleware/auth');
const { requirePrivacyTier } = require('../middleware/privacyTier');
const {
  createGift,
  getGifts,
  getGiftsForCouple,
  getGiftById,
  deleteGift,
  updateGift
} = require('../controllers/giftController');

const router = express.Router();

router.use(authenticate);
router.use(requireEmailVerified);

router.get(
  '/couple/:coupleId',
  requireRole('guest', 'couple', 'admin'),
  getGiftsForCouple
);

router.get(
  '/:giftId',
  requireRole('guest', 'couple', 'admin'),
  requirePrivacyTier({ giftIdSource: 'params.giftId' }),
  getGiftById
);


router.post('/', requireRole('couple'), createGift);
router.get('/', requireRole('couple'), getGifts);
router.put('/:giftId', requireRole('couple'), updateGift);
router.delete('/:giftId', requireRole('couple'), deleteGift);

module.exports = router;
