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

// ─── Публичные (для гостей) маршруты с проверкой privacy tier ─────────────
// requirePrivacyTier проверяет, что гость имеет доступ к подарку
// на основе его kinshipTier и allowedTiers подарка.
// Если гость не добавлен в родословную — 403 Forbidden.
// Если тир гостя не имеет доступа к подарку — 403 Forbidden.

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

// ─── Маршруты для пары (создание/редактирование своих подарков) ──────────
router.post('/', requireRole('couple'), createGift);
router.get('/', requireRole('couple'), getGifts);
router.put('/:giftId', requireRole('couple'), updateGift);
router.delete('/:giftId', requireRole('couple'), deleteGift);

module.exports = router;
