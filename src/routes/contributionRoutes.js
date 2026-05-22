const express = require('express');
const { authenticate, requireRole, requireEmailVerified } = require('../middleware/auth');
const { requirePrivacyTier } = require('../middleware/privacyTier');
const {
  createContribution,
  getContributionsByGift
} = require('../controllers/contributionController');

const router = express.Router();

// ─── Создание взноса — проверяем, что гость имеет доступ к подарку ───────
router.post(
  '/',
  authenticate,
  requireEmailVerified,
  requireRole('guest', 'couple', 'admin'),
  requirePrivacyTier({ giftIdSource: 'body.giftId' }),
  createContribution
);

// ─── Просмотр взносов по подарку — проверяем доступ к подарку ────────────
router.get(
  '/gift/:giftId',
  authenticate,
  requireEmailVerified,
  requireRole('guest', 'couple', 'admin'),
  requirePrivacyTier({ giftIdSource: 'params.giftId' }),
  getContributionsByGift
);

module.exports = router;