const express = require('express');
const { authenticate, requireRole, requireEmailVerified } = require('../middleware/auth');
const {
  purchaseGift,
  deliverGift,
  approveSingleContribution,
  getEscrowStatus,
} = require('../controllers/escrowController');

const router = express.Router();


router.use(authenticate);
router.use(requireEmailVerified);



router.get('/:giftId', requireRole('couple', 'admin'), getEscrowStatus);

router.post('/:giftId/purchase', requireRole('couple'), purchaseGift);

router.post('/:giftId/deliver', requireRole('couple'), deliverGift);

router.post('/contributions/:contributionId/approve', requireRole('couple'), approveSingleContribution);

module.exports = router;
