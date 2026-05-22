const express = require('express');
const { authenticate, requireRole, requireEmailVerified } = require('../middleware/auth');
const { requirePrivacyTier } = require('../middleware/privacyTier');
const {
  createContribution,
  getContributionsByGift
} = require('../controllers/contributionController');

const router = express.Router();


router.post(
  '/',
  authenticate,
  requireEmailVerified,
  requireRole('guest', 'couple', 'admin'),
  requirePrivacyTier({ giftIdSource: 'body.giftId' }),
  createContribution
);


router.get(
  '/gift/:giftId',
  authenticate,
  requireEmailVerified,
  requireRole('guest', 'couple', 'admin'),
  requirePrivacyTier({ giftIdSource: 'params.giftId' }),
  getContributionsByGift
);

module.exports = router;