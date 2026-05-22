const { prisma } = require('../config/database');
const {
  transitionGift,
  approveContribution,
  approveAllContributions,
  STATE_LABELS,
} = require('../services/giftStateMachine');
const {
  annotateFlags,
  buildDeliveryNote,
  getPackagingRequirements,
  orchestrateLifecycleFlags,
  validateLogisticsTransition,
  buildLogisticsManifest,
  calculateDeliveryComplexity,
} = require('../services/handlingFlagsService');

// ─── Purchase a gift (funded → purchased) ─────────────────────────────────

/**
 * Couple purchases a funded gift.
 * This transitions the gift from funded → purchased.
 * All completed contributions must be escrow-approved first.
 */
async function purchaseGift(req, res) {
  const { giftId } = req.params;
  const coupleId = req.user.id;

  try {
    // Optional: first approve all unapproved contributions
    await approveAllContributions(parseInt(giftId), coupleId);

    // Then transition the gift
    const updatedGift = await transitionGift(
      parseInt(giftId),
      'purchased',
      { expectedVersion: req.body.expectedVersion }
    );

    // ── Оркестрационные данные из state machine ──────────────────
    const orchestration = updatedGift._logisticsOrchestration;

    res.json({
      message: 'Gift marked as purchased successfully',
      gift: {
        id: updatedGift.id,
        name: updatedGift.name,
        status: updatedGift.status,
        statusLabel: STATE_LABELS[updatedGift.status],
        fundedAmount: updatedGift.fundedAmount,
        targetAmount: updatedGift.targetAmount,
        currency: updatedGift.currency,
        handlingFlags: updatedGift.handlingFlags || [],
        handlingFlagsInfo: annotateFlags(updatedGift.handlingFlags || []),
        deliveryNote: buildDeliveryNote(updatedGift.handlingFlags || []),
        packagingRequirements: getPackagingRequirements(updatedGift.handlingFlags || []),
        updatedAt: updatedGift.updatedAt,

        // ═══ НОВОЕ: Динамическая оркестрация флагов при покупке ═══
        logisticsOrchestration: orchestration ? {
          stage: orchestration.stage,
          stageInfo: orchestration.stageInfo,
          flags: orchestration.flags,
          deliveryComplexity: orchestration.deliveryComplexity,
          manifest: orchestration.manifest,
          flagChainSummary: orchestration.flagChainSummary,
          transitionValidation: orchestration.transitionValidation,
        } : null,
      },
    });
  } catch (error) {
    console.error('Purchase gift error:', error);

    if (error.message === 'GIFT_NOT_FOUND') {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Gift not found',
        timestamp: new Date().toISOString(),
      });
    }

    if (error.message.startsWith('INVALID_STATE_TRANSITION') || error.message.startsWith('INVALID_TRANSITION:')) {
      return res.status(409).json({
        code: 'INVALID_STATE_TRANSITION',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    if (error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    if (error.message.startsWith('INVALID_APPROVAL') || error.message.startsWith('INVALID_STATE')) {
      return res.status(409).json({
        code: 'STATE_CONFLICT',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to purchase gift',
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── Deliver a gift (purchased → delivered) ──────────────────────────────

/**
 * Couple confirms delivery of a gift.
 * This transitions the gift from purchased → delivered.
 * This is a terminal state.
 */
async function deliverGift(req, res) {
  const { giftId } = req.params;
  const coupleId = req.user.id;

  try {
    const updatedGift = await transitionGift(
      parseInt(giftId),
      'delivered'
    );

    // ── Оркестрационные данные из state machine ──────────────────
    const orchestration = updatedGift._logisticsOrchestration;

    res.json({
      message: 'Gift marked as delivered successfully',
      gift: {
        id: updatedGift.id,
        name: updatedGift.name,
        status: updatedGift.status,
        statusLabel: STATE_LABELS[updatedGift.status],
        fundedAmount: updatedGift.fundedAmount,
        targetAmount: updatedGift.targetAmount,
        currency: updatedGift.currency,
        handlingFlags: updatedGift.handlingFlags || [],
        handlingFlagsInfo: annotateFlags(updatedGift.handlingFlags || []),
        deliveryNote: buildDeliveryNote(updatedGift.handlingFlags || []),
        packagingRequirements: getPackagingRequirements(updatedGift.handlingFlags || []),
        updatedAt: updatedGift.updatedAt,

        // ═══ НОВОЕ: Полный отчёт динамической оркестрации ══════════
        logisticsOrchestration: orchestration ? {
          stage: orchestration.stage,
          stageInfo: orchestration.stageInfo,
          flags: orchestration.flags,
          deliveryComplexity: orchestration.deliveryComplexity,
          manifest: orchestration.logisticsManifest,
          flagChainSummary: orchestration.flagChainSummary,
          transitionValidation: orchestration.transitionValidation,
          finalInstructions: orchestration.finalInstructions,
          lifecycleStage: orchestration.lifecycleStage,
        } : null,
      },
    });
  } catch (error) {
    console.error('Deliver gift error:', error);

    if (error.message === 'GIFT_NOT_FOUND') {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Gift not found',
        timestamp: new Date().toISOString(),
      });
    }

    if (error.message.startsWith('INVALID_STATE_TRANSITION')) {
      return res.status(409).json({
        code: 'INVALID_STATE_TRANSITION',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to deliver gift',
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── Approve a single contribution for escrow release ────────────────────

/**
 * Couple approves a specific contribution for escrow release.
 */
async function approveSingleContribution(req, res) {
  const { contributionId } = req.params;
  const coupleId = req.user.id;

  try {
    const updated = await approveContribution(parseInt(contributionId), coupleId);

    res.json({
      message: 'Contribution approved for escrow release',
      contribution: {
        id: updated.id,
        giftId: updated.giftId,
        amount: updated.amount,
        escrowApprovedAt: updated.escrowApprovedAt,
        escrowApprovedBy: updated.escrowApprovedBy,
      },
    });
  } catch (error) {
    console.error('Approve contribution error:', error);

    if (error.message === 'CONTRIBUTION_NOT_FOUND') {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Contribution not found',
        timestamp: new Date().toISOString(),
      });
    }

    if (error.message.startsWith('FORBIDDEN')) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    if (error.message.startsWith('INVALID_APPROVAL') || error.message.startsWith('INVALID_STATE')) {
      return res.status(409).json({
        code: 'STATE_CONFLICT',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to approve contribution',
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── Get escrow status for a gift ────────────────────────────────────────

async function getEscrowStatus(req, res) {
  const { giftId } = req.params;
  const userId = req.user.id;

  try {
    const gift = await prisma.gift.findUnique({
      where: { id: parseInt(giftId) },
      include: {
        contributions: {
          where: { status: 'completed' },
          select: {
            id: true,
            amount: true,
            escrowApprovedAt: true,
            escrowApprovedBy: true,
            timestamp: true,
            guest: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!gift) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Gift not found',
        timestamp: new Date().toISOString(),
      });
    }

    // Only couple and admins can see escrow details
    const isOwner = req.user.role === 'couple' && gift.coupleId === userId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Only the couple can view escrow status',
        timestamp: new Date().toISOString(),
      });
    }

    const totalApproved = gift.contributions.filter(c => c.escrowApprovedAt !== null)
      .reduce((sum, c) => sum + c.amount, 0);
    const totalPending = gift.contributions.filter(c => c.escrowApprovedAt === null)
      .reduce((sum, c) => sum + c.amount, 0);

    // ── Оркестрационные данные ────────────────────────────────────
    const flags = gift.handlingFlags || [];
    const lifecycleInfo = orchestrateLifecycleFlags({
      flags,
      fromStage: gift.status,
      toStage: gift.status,
      giftInfo: { name: gift.name },
    });

    res.json({
      giftId: gift.id,
      giftName: gift.name,
      status: gift.status,
      statusLabel: STATE_LABELS[gift.status],
      allowedTransitions: Object.keys(require('../services/giftStateMachine').VALID_TRANSITIONS[gift.status] || {}),
      handlingFlags: flags,
      handlingFlagsInfo: annotateFlags(flags),
      deliveryNote: buildDeliveryNote(flags),
      packagingRequirements: getPackagingRequirements(flags),
      escrow: {
        totalFunded: gift.fundedAmount,
        targetAmount: gift.targetAmount,
        totalApprovedForEscrow: totalApproved,
        totalPendingApproval: totalPending,
        currency: gift.currency,
      },

      // ═══ НОВОЕ: Актуальные оркестрационные данные для текущего статуса ═══
      logisticsOrchestration: {
        stage: lifecycleInfo.stage,
        stageInfo: lifecycleInfo.stageInfo,
        lifecycleContext: lifecycleInfo.lifecycleContext,
        deliveryComplexity: lifecycleInfo.deliveryComplexity,
        manifest: lifecycleInfo.manifest,
        flagCompatibility: lifecycleInfo.flagCompatibility,
      },

      contributions: gift.contributions.map(c => ({
        id: c.id,
        amount: c.amount,
        guestName: c.guest.fullName,
        contributedAt: c.timestamp,
        escrowApproved: c.escrowApprovedAt !== null,
        escrowApprovedAt: c.escrowApprovedAt,
        escrowApprovedBy: c.escrowApprovedBy,
      })),
    });
  } catch (error) {
    console.error('Get escrow status error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get escrow status',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  purchaseGift,
  deliverGift,
  approveSingleContribution,
  getEscrowStatus,
};
