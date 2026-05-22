const express = require('express');
const { authenticate, requireRole, requireEmailVerified } = require('../middleware/auth');
const {
  purchaseGift,
  deliverGift,
  approveSingleContribution,
  getEscrowStatus,
} = require('../controllers/escrowController');

const router = express.Router();

// All escrow routes require authentication and verified email
router.use(authenticate);
router.use(requireEmailVerified);

// ─── Escrow status ───────────────────────────────────────────────────────
// GET /escrow/:giftId — view escrow status (couple/admin only)
router.get('/:giftId', requireRole('couple', 'admin'), getEscrowStatus);

// ─── Escrow actions (couple only) ────────────────────────────────────────

// POST /escrow/:giftId/purchase — transition funded → purchased
router.post('/:giftId/purchase', requireRole('couple'), purchaseGift);

// POST /escrow/:giftId/deliver — transition purchased → delivered
router.post('/:giftId/deliver', requireRole('couple'), deliverGift);

// POST /escrow/contributions/:contributionId/approve — approve single contribution for escrow
router.post('/contributions/:contributionId/approve', requireRole('couple'), approveSingleContribution);

module.exports = router;
