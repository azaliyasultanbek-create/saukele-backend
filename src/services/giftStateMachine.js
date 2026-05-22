/**
 * Gift State Machine
 * 
 * Enforces valid state transitions for the gift lifecycle with escrow:
 * 
 *   pending ──► funding ──► funded ──► purchased ──► delivered
 *                                                         │
 *                                                         ▼
 *                                                    (terminal)
 * 
 * Rules:
 * - pending:  initial state, gift is visible/editable by couple
 * - funding:  first contribution received, accepting contributions
 * - funded:   targetAmount reached, no more contributions accepted
 * - purchased: couple confirms purchase (escrowed funds spent), triggers payment to merchant
 * - delivered: final state, gift received
 * 
 * Transitions that are NOT allowed will throw errors.
 */

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

// ─── Valid transition map ────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  pending:   ['funding'],
  funding:   ['funded'],
  funded:    ['purchased'],
  purchased: ['delivered'],
};

// ─── Human-readable labels ───────────────────────────────────────────────
const STATE_LABELS = {
  pending:   'Pending / Ожидает',
  funding:   'Funding / Сбор средств',
  funded:    'Funded / Собрано',
  purchased: 'Purchased / Куплено',
  delivered: 'Delivered / Доставлено',
};

// ─── Lock timeout for SELECT FOR UPDATE ──────────────────────────────────
const LOCK_TIMEOUT_MS = 3000;

// ─── Helpers ─────────────────────────────────────────────────────────────

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

// ─── Core: Transition a gift with row-level lock (SELECT FOR UPDATE) ─────

/**
 * Atomically transition a gift's escrowStatus using SELECT FOR UPDATE.
 * 
 * @param {number}  giftId
 * @param {string}  toStatus   - target GiftStatus
 * @param {object}  [options]
 * @param {object}  [options.tx] - optional existing Prisma transaction client
 * @param {number}  [options.expectedVersion] - for optimistic concurrency
 * @returns {Promise<object>} updated gift
 */
async function transitionGift(giftId, toStatus, options = {}) {
  const tx = options.tx || prisma;

  // 1. Lock the gift row (SELECT FOR UPDATE) and read current state
  const lockedGifts = await tx.$queryRawUnsafe(
    `SELECT id, status, funded_amount, target_amount, version, handling_flags
     FROM gifts
     WHERE id = $1
     FOR UPDATE NOWAIT`,
    giftId
  );

  if (!lockedGifts || lockedGifts.length === 0) {
    throw new Error('GIFT_NOT_FOUND');
  }

  const gift = lockedGifts[0];
  const fromStatus = gift.status;

  // 2. Validate transition
  assertValidTransition(fromStatus, toStatus);

  // 3. Check business rules for specific transitions (includes logistics orchestration)
  const logisticsOutput = await validateBusinessRules(giftId, fromStatus, toStatus, { tx });

  // 4. Perform the update (version bump for optimistic locking)
  const updated = await tx.gift.update({
    where: { id: giftId },
    data: {
      status: toStatus,
      version: { increment: 1 },
    },
  });

  // 5. Attach logistics orchestration info to the returned gift
  //    so controllers can include it in responses without re-querying
  updated._logisticsOrchestration = logisticsOutput;

  // 6. Log lifecycle transition with flag propagation info
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

// ─── Business rule validators ────────────────────────────────────────────

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
      // fundedAmount must equal or exceed targetAmount
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
      // All escrowed contributions must be approved
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

      // ─── Динамическая оркестрация флагов: purchased ─────────────────
      // Проверяем логистические требования перед покупкой
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
          // Валидируем логистический переход funded → purchased
          const transitionCheck = validateLogisticsTransition(flags, 'funded', 'purchased');

          // Оркестрируем флаги
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
      // Load full gift data including handling flags
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

      // ─── ДИНАМИЧЕСКАЯ ОРКЕСТРАЦИЯ ЛОГИСТИКИ ПРИ ДОСТАВКЕ ──────────
      // Флаги "протекают" через весь lifecycle: pending → funding → funded → purchased → delivered
      // На этапе delivered формируем финальный отчёт по всей цепочке.

      const deliveryNote = buildDeliveryNote(flags);
      const packaging = getPackagingRequirements(flags);

      // Используем новую функцию полной оркестрации
      const orchestration = orchestrateLifecycleFlags({
        flags,
        fromStage: 'purchased',
        toStage: 'delivered',
        flagChain: null, // цепочка начнётся здесь (в реальности можно хранить в БД)
        giftInfo: {
          name: gift.name,
          targetAmount: gift.targetAmount,
          currency: gift.currency,
        },
      });

      // Дополнительно создаём манифест
      const manifest = buildLogisticsManifest(flags, {
        name: gift.name,
        targetAmount: gift.targetAmount,
        currency: gift.currency,
      });
      const complexity = calculateDeliveryComplexity(flags);
      const compatibility = checkFlagCompatibility(flags);
      const lifecycleInfo = getFlagsForLifecycleStage(flags, 'delivered');

      // ── Финальное логирование ──────────────────────────────────────
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

      // ── Проверка перехода ──────────────────────────────────────────
      const transitionValidation = validateLogisticsTransition(flags, 'purchased', 'delivered');
      if (transitionValidation.warnings.length > 0) {
        console.warn(
          `[LogisticsOrchestration] Delivery warnings for gift #${giftId}:`,
          transitionValidation.warnings,
        );
      }

      // Возвращаем полные данные оркестрации
      return {
        // Основное
        handlingFlags: flags,
        handlingFlagsInfo: annotateFlags(flags),
        deliveryNote,
        packagingRequirements: packaging,

        // Манифест и сложность
        logisticsManifest: manifest,
        deliveryComplexity: complexity,

        // Совместимость
        flagCompatibility: compatibility,
        lifecycleStage: lifecycleInfo,

        // ═══ НОВОЕ: динамическая оркестрация ═══
        orchestration: {
          stage: orchestration.stage,
          stageInfo: orchestration.stageInfo,
          transitionValidation,
          flagChain: orchestration.flagChain,
          flagChainSummary: orchestration.flagChainSummary,
        },

        // Финальные инструкции
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

// ─── Escrow approval for individual contributions ────────────────────────

/**
 * Approve a single contribution for escrow release (mark as approved by couple).
 * Uses SELECT FOR UPDATE to prevent race conditions.
 */
async function approveContribution(contributionId, coupleId, options = {}) {
  const tx = options.tx || prisma;

  // Lock the contribution row
  const locked = await tx.$queryRawUnsafe(
    `SELECT c.id, c.gift_id, c.status, c.guest_id, g.couple_id, g.status AS gift_status
     FROM contributions c
     JOIN gifts g ON g.id = c.gift_id
     WHERE c.id = $1
     FOR UPDATE NOWAIT`,
    contributionId
  );

  if (!locked || locked.length === 0) {
    throw new Error('CONTRIBUTION_NOT_FOUND');
  }

  const row = locked[0];

  // Verify the couple owns this gift
  if (row.couple_id !== coupleId) {
    throw new Error('FORBIDDEN: This gift does not belong to you');
  }

  // Contribution must be completed
  if (row.status !== 'completed') {
    throw new Error('INVALID_APPROVAL: Only completed contributions can be escrow-approved');
  }

  // Gift must be in funded state to approve
  if (row.gift_status !== 'funded') {
    throw new Error(
      `INVALID_APPROVAL: Gift must be in "funded" status to approve contributions (current: "${row.gift_status}")`
    );
  }

  // ── Проверка иммутабельности ──
  // Убеждаемся, что locked поля у взноса есть (snapshot был записан)
  const dbContribution = await tx.contribution.findUnique({
    where: { id: contributionId },
    select: { lockedAt: true, lockedRate: true },
  });

  if (!dbContribution.lockedAt || !dbContribution.lockedRate) {
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

/**
 * Approve ALL completed contributions for a gift (bulk operation).
 * Used when transitioning from funded → purchased.
 */
async function approveAllContributions(giftId, coupleId, options = {}) {
  const tx = options.tx || prisma;

  // Lock the gift row
  const lockedGifts = await tx.$queryRawUnsafe(
    `SELECT id, couple_id, status, handling_flags FROM gifts WHERE id = $1 FOR UPDATE NOWAIT`,
    giftId
  );

  if (!lockedGifts || lockedGifts.length === 0) {
    throw new Error('GIFT_NOT_FOUND');
  }

  const gift = lockedGifts[0];

  if (gift.couple_id !== coupleId) {
    throw new Error('FORBIDDEN: This gift does not belong to you');
  }

  if (gift.status !== 'funded') {
    throw new Error(
      `INVALID_STATE: Gift must be "funded" to bulk-approve contributions (current: "${gift.status}")`
    );
  }

  // ─── Оркестрация: проверяем флаги при подтверждении выплат ──────────
  const flags = gift.handling_flags || [];
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

    // Если есть конфликты флагов — логируем предупреждение
    if (compatibility.hasConflicts) {
      console.warn(
        `[LogisticsOrchestration] WARNING: Flag compatibility issues for gift #${giftId}:`,
        JSON.stringify(compatibility.conflicts),
      );
    }
  }

  // Approve all unapproved completed contributions
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

// ─── Public API ──────────────────────────────────────────────────────────

module.exports = {
  VALID_TRANSITIONS,
  STATE_LABELS,
  isValidTransition,
  assertValidTransition,
  transitionGift,
  approveContribution,
  approveAllContributions,
};
