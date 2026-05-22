

const { prisma } = require('../config/database');
const { guardImmutableFields } = require('./immutableFieldsService');
const {
  annotateFlags,
  buildDeliveryNote,
  getPackagingRequirements,
  buildLogisticsManifest,
  getFlagsForLifecycleStage,
  calculateDeliveryComplexity,
  checkFlagCompatibility,
  validateLogisticsTransition,
  orchestrateLifecycleFlags,
  createFlagChain,
  propagateFlagsToStage,
} = require('./handlingFlagsService');


const VALID_TRANSITIONS = {
  pending:   ['funding'],
  funding:   ['funded'],
  funded:    ['purchased'],
  purchased: ['delivered'],
};


const STATE_LABELS = {
  pending:   'Pending / Ожидает',
  funding:   'Funding / Сбор средств',
  funded:    'Funded / Собрано',
  purchased: 'Purchased / Куплено',
  delivered: 'Delivered / Доставлено',
};


const LOCK_TIMEOUT_MS = 3000;



function isValidTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

function assertValidTransition(from, to) {
  if (!isValidTransition(from, to)) {
    const labelFrom = STATE_LABELS[from] || from;
    const labelTo = STATE_LABELS[to] || to;
    throw new Error(
      `INVALID_STATE_TRANSITION: Cannot transition gift from "${labelFrom}" to "${labelTo}". ` +
      `Allowed transitions from "${labelFrom}": ${(VALID_TRANSITIONS[from] || []).map(s => `"${STATE_LABELS[s] || s}"`).join(', ') || 'none'}`
    );
  }
}



/**
 
 * @param {number}  giftId
 * @param {string}  toStatus   
 * @param {object}  [options]
 * @param {object}  [options.tx] 
 * @param {number}  [options.expectedVersion] 
 * @returns {Promise<object>} 
 */
async function transitionGift(giftId, toStatus, options = {}) {
  const tx = options.tx || prisma;


  const gift = await tx.gift.findUnique({
    where: { id: giftId },
    select: {
      id: true,
      status: true,
      fundedAmount: true,
      targetAmount: true,
      version: true,
      handlingFlags: true,
    },
  });

  if (!gift) {
    throw new Error('GIFT_NOT_FOUND');
  }

  const fromStatus = gift.status;

  assertValidTransition(fromStatus, toStatus);

  
  const logisticsOutput = await validateBusinessRules(giftId, fromStatus, toStatus, { tx });

  
  const updated = await tx.gift.update({
    where: {
      id: giftId,
      version: gift.version, 
    },
    data: {
      status: toStatus,
      version: { increment: 1 },
    },
  }).catch((err) => {
    
    if (err.code === 'P2025') {
      throw new Error(
        'CONCURRENT_MODIFICATION: Gift was modified by another request. Please retry.'
      );
    }
    throw err;
  });


  updated._logisticsOrchestration = logisticsOutput;

  
  const flags = Array.isArray(updated.handlingFlags) ? updated.handlingFlags : [];
  const complexityLabel = logisticsOutput?.deliveryComplexity?.level || 'N/A';
  const flagInfo = flags.length > 0 ? `[${flags.join(', ')}]` : 'none';

  console.log(
    `[GiftStateMachine] Gift #${giftId}: ${fromStatus} → ${toStatus}`,
    `| Flags: ${flagInfo}`,
    `| Complexity: ${complexityLabel}`,
    logisticsOutput?.transitionValidation?.warnings?.length
      ? `| Warnings: ${logisticsOutput.transitionValidation.warnings.join('; ')}`
      : '',
  );

  return updated;
}



async function validateBusinessRules(giftId, fromStatus, toStatus, { tx }) {
  switch (toStatus) {
    case 'funding': {
      // Must have at least one contribution
      const count = await tx.contribution.count({
        where: { giftId, status: 'completed' },
      });
      if (count === 0) {
        throw new Error('INVALID_TRANSITION: Cannot start funding without at least one completed contribution');
      }
      return null;
    }

    case 'funded': {
      
      const gift = await tx.gift.findUnique({
        where: { id: giftId },
        select: { fundedAmount: true, targetAmount: true },
      });
      if (!gift) throw new Error('GIFT_NOT_FOUND');
      if (gift.fundedAmount < gift.targetAmount) {
        throw new Error(
          `INVALID_TRANSITION: Gift not fully funded (${gift.fundedAmount}/${gift.targetAmount})`
        );
      }
      return null;
    }

    case 'purchased': {
   
      const unapprovedCount = await tx.contribution.count({
        where: {
          giftId,
          status: 'completed',
          escrowApprovedAt: null,
        },
      });
      if (unapprovedCount > 0) {
        throw new Error(
          `INVALID_TRANSITION: Cannot purchase — ${unapprovedCount} contribution(s) not yet escrow-approved`
        );
      }

    
      const giftForFlags = await tx.gift.findUnique({
        where: { id: giftId },
        select: {
          id: true,
          name: true,
          handlingFlags: true,
          targetAmount: true,
          currency: true,
        },
      });

      if (giftForFlags) {
        const flags = giftForFlags.handlingFlags || [];

        if (Array.isArray(flags) && flags.length > 0) {
          
          const transitionCheck = validateLogisticsTransition(flags, 'funded', 'purchased');

    
          const orchestration = orchestrateLifecycleFlags({
            flags,
            fromStage: 'funded',
            toStage: 'purchased',
            flagChain: null,
            giftInfo: {
              name: giftForFlags.name,
              targetAmount: giftForFlags.targetAmount,
              currency: giftForFlags.currency,
            },
          });

          console.log(
            `[FlagOrchestration] Gift #${giftId} purchased with flags: [${flags.join(', ')}]`,
            `\n  Transition warnings: ${transitionCheck.warnings.length > 0 ? transitionCheck.warnings.join('; ') : 'none'}`,
            `\n  Manifest ready: ${orchestration.manifest ? 'yes' : 'no'}`,
            `\n  Complexity: ${orchestration.deliveryComplexity.level}`,
          );

          if (transitionCheck.warnings.length > 0) {
            console.warn(
              `[FlagOrchestration] Purchasing gift #${giftId} with warnings:`,
              transitionCheck.warnings,
            );
          }

          return orchestration;
        }
      }

      return null;
    }

    case 'delivered': {
      
      const gift = await tx.gift.findUnique({
        where: { id: giftId },
        select: {
          id: true,
          name: true,
          coupleId: true,
          handlingFlags: true,
          targetAmount: true,
          currency: true,
        },
      });

      if (!gift) throw new Error('GIFT_NOT_FOUND');

      const flags = gift.handlingFlags || [];

      

      const deliveryNote = buildDeliveryNote(flags);
      const packaging = getPackagingRequirements(flags);

      
      const orchestration = orchestrateLifecycleFlags({
        flags,
        fromStage: 'purchased',
        toStage: 'delivered',
        flagChain: null, 
        giftInfo: {
          name: gift.name,
          targetAmount: gift.targetAmount,
          currency: gift.currency,
        },
      });

     
      const manifest = buildLogisticsManifest(flags, {
        name: gift.name,
        targetAmount: gift.targetAmount,
        currency: gift.currency,
      });
      const complexity = calculateDeliveryComplexity(flags);
      const compatibility = checkFlagCompatibility(flags);
      const lifecycleInfo = getFlagsForLifecycleStage(flags, 'delivered');

      
      const chainSummary = orchestration.flagChainSummary;
      console.log(
        `[LogisticsOrchestration] 🎯 Gift #${gift.id} "${gift.name}" DELIVERED.`,
        `\n  Flags: [${flags.join(', ')}]`,
        `\n  Complexity: ${complexity.level} (score: ${complexity.score})`,
        `\n  Note: ${deliveryNote}`,
        `\n  Packaging: ${packaging.packagingReason}`,
        `\n  Manifest: ${manifest ? '✓ generated' : '✗ none'}`,
        `\n  Chain propagations: ${chainSummary?.totalPropagations || 0}`,
        `\n  Compatibility warnings: ${compatibility.hasConflicts ? JSON.stringify(compatibility.conflicts) : 'none'}`,
      );

      
      const transitionValidation = validateLogisticsTransition(flags, 'purchased', 'delivered');
      if (transitionValidation.warnings.length > 0) {
        console.warn(
          `[LogisticsOrchestration] Delivery warnings for gift #${giftId}:`,
          transitionValidation.warnings,
        );
      }

     
      return {
        
        handlingFlags: flags,
        handlingFlagsInfo: annotateFlags(flags),
        deliveryNote,
        packagingRequirements: packaging,

       
        logisticsManifest: manifest,
        deliveryComplexity: complexity,

       
        flagCompatibility: compatibility,
        lifecycleStage: lifecycleInfo,

        
        orchestration: {
          stage: orchestration.stage,
          stageInfo: orchestration.stageInfo,
          transitionValidation,
          flagChain: orchestration.flagChain,
          flagChainSummary: orchestration.flagChainSummary,
        },

        
        finalInstructions: {
          deliveryNote,
          signatureRequired: flags.some(f => require('./handlingFlagsService').HANDLING_FLAGS[f]?.requiresSignature),
          insuranceRequired: flags.some(f => require('./handlingFlagsService').HANDLING_FLAGS[f]?.requiresInsurance),
          specialTransportRequired: flags.some(f => require('./handlingFlagsService').HANDLING_FLAGS[f]?.requiresSpecialTransport),
        },
      };
    }

    default:
      return null;
  }
}




async function approveContribution(contributionId, coupleId, options = {}) {
  const tx = options.tx || prisma;

  const contribution = await tx.contribution.findUnique({
    where: { id: contributionId },
    include: {
      gift: {
        select: {
          id: true,
          coupleId: true,
          status: true,
        },
      },
    },
  });

  if (!contribution) {
    throw new Error('CONTRIBUTION_NOT_FOUND');
  }

 
  if (contribution.gift.coupleId !== coupleId) {
    throw new Error('FORBIDDEN: This gift does not belong to you');
  }

  
  if (contribution.status !== 'completed') {
    throw new Error('INVALID_APPROVAL: Only completed contributions can be escrow-approved');
  }

  if (contribution.gift.status !== 'funded') {
    throw new Error(
      `INVALID_APPROVAL: Gift must be in "funded" status to approve contributions (current: "${contribution.gift.status}")`
    );
  }


  if (!contribution.lockedAt || !contribution.lockedRate) {
    throw new Error(
      `IMMUTABLE_FIELD_VIOLATION: Contribution #${contributionId} is missing ` +
      `locked_at_timestamp/locked_exchange_rate. Data integrity check failed.`
    );
  }

  const updated = await tx.contribution.update({
    where: { id: contributionId },
    data: {
      escrowApprovedAt: new Date(),
      escrowApprovedBy: coupleId,
    },
  });

  return updated;
}


async function approveAllContributions(giftId, coupleId, options = {}) {
  const tx = options.tx || prisma;


  const gift = await tx.gift.findUnique({
    where: { id: giftId },
    select: {
      id: true,
      coupleId: true,
      status: true,
      handlingFlags: true,
    },
  });

  if (!gift) {
    throw new Error('GIFT_NOT_FOUND');
  }

  if (gift.coupleId !== coupleId) {
    throw new Error('FORBIDDEN: This gift does not belong to you');
  }

  if (gift.status !== 'funded') {
    throw new Error(
      `INVALID_STATE: Gift must be "funded" to bulk-approve contributions (current: "${gift.status}")`
    );
  }

 
  const flags = gift.handlingFlags || [];
  if (Array.isArray(flags) && flags.length > 0) {
    const manifest = buildLogisticsManifest(flags);
    const complexity = calculateDeliveryComplexity(flags);
    const compatibility = checkFlagCompatibility(flags);

    console.log(
      `[LogisticsOrchestration] Escrow approval for gift #${giftId}.`,
      `\n  Flags: [${flags.join(', ')}]`,
      `\n  Complexity: ${complexity.level}`,
      `\n  Manifest generated: ${JSON.stringify(manifest)}`,
    );

    if (compatibility.hasConflicts) {
      console.warn(
        `[LogisticsOrchestration] WARNING: Flag compatibility issues for gift #${giftId}:`,
        JSON.stringify(compatibility.conflicts),
      );
    }
  }

  const result = await tx.contribution.updateMany({
    where: {
      giftId,
      status: 'completed',
      escrowApprovedAt: null,
    },
    data: {
      escrowApprovedAt: new Date(),
      escrowApprovedBy: coupleId,
    },
  });

  return { approvedCount: result.count };
}



module.exports = {
  VALID_TRANSITIONS,
  STATE_LABELS,
  isValidTransition,
  assertValidTransition,
  transitionGift,
  approveContribution,
  approveAllContributions,
};
