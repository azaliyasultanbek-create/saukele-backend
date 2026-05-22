const { emailQueue } = require('../queues/emailQueue');
const { prisma } = require('../config/database');

/**
 * Queue a registry invitation email to be sent asynchronously.
 *
 * Flow: Controller → Service → Queue → Worker → EmailService
 *
 * @param {Object} params
 * @param {string} params.recipientEmail - The email address of the person being invited
 * @param {string} params.inviterName - Name of the person/couple sending the invitation
 * @param {string} params.registryName - Name of the wedding registry
 * @param {string} params.invitationLink - URL/link for the invitation
 * @returns {Promise<Object>} The queued job info
 */
async function queueRegistryInvitationEmail({ recipientEmail, inviterName, registryName, invitationLink }) {
  if (!recipientEmail) {
    throw new Error('recipientEmail is required');
  }
  if (!inviterName) {
    throw new Error('inviterName is required');
  }
  if (!registryName) {
    throw new Error('registryName is required');
  }
  if (!invitationLink) {
    throw new Error('invitationLink is required');
  }

  const job = await emailQueue.add('registry-invitation', {
    type: 'registry-invitation',
    to: recipientEmail,
    data: {
      inviterName,
      registryName,
      invitationLink,
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
    },
  });

  console.log(`[RegistryService] Queued registry invitation email job ${job.id} to ${recipientEmail}`);

  return {
    jobId: job.id,
    recipientEmail,
    status: 'queued',
  };
}

/**
 * Queue a funding progress update email to all guests (except the contributor)
 * after a successful contribution.
 *
 * Flow: Controller → Service → Queue → Worker → EmailService
 *
 * Uses deduplication (30s TTL) to avoid spamming guests when multiple
 * contributions come in quick succession.
 *
 * @param {Object} params
 * @param {number} params.coupleId - ID of the couple (gift owner)
 * @param {number} params.giftId - ID of the gift
 * @param {string} params.giftName - Name of the gift
 * @param {number} params.fundedAmount - Current funded amount in gift currency
 * @param {number} params.targetAmount - Target amount in gift currency
 * @param {string} params.currency - Gift currency (KZT, USD, EUR)
 * @param {number} params.progressPercent - Progress percentage (0–100)
 * @param {string} params.contributorName - Name of the person who just contributed
 * @param {number} params.contributorId - ID of the contributor (to exclude from guest list)
 * @returns {Promise<Object>} The queued job info
 */
async function queueFundingProgressUpdateEmail({
  coupleId,
  giftId,
  giftName,
  fundedAmount,
  targetAmount,
  currency,
  progressPercent,
  contributorName,
  contributorId,
}) {
  if (!coupleId || !giftId) {
    throw new Error('coupleId and giftId are required');
  }

  // Получаем всех гостей из family_tree для данной пары, у которых есть email
  const familyEntries = await prisma.familyTree.findMany({
    where: { coupleId },
    include: {
      guest: {
        select: { id: true, email: true },
      },
    },
  });

  // Исключаем того, кто только что сделал взнос
  const guestEmails = familyEntries
    .filter(entry => entry.guest.email && entry.guest.id !== contributorId)
    .map(entry => entry.guest.email);

  if (guestEmails.length === 0) {
    console.log(`[RegistryService] No other guests with emails to notify for gift ${giftId}`);
    return { jobId: null, status: 'skipped', reason: 'no_other_guests' };
  }

  const job = await emailQueue.add('funding-progress-update', {
    type: 'funding-progress-update',
    to: null, // массовая рассылка — to не используется
    data: {
      coupleId,
      giftId,
      giftName,
      fundedAmount,
      targetAmount,
      currency,
      progressPercent,
      contributorName,
      guestEmails,
    },
    opts: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 10000 },
      removeOnComplete: 100,
      deduplication: {
        id: `funding-progress-${coupleId}-${giftId}`,
        ttl: 30000, // 30 секунд дебаунс
      },
    },
  });

  console.log(`[RegistryService] Queued funding progress update job ${job.id} for gift ${giftId} (${guestEmails.length} guests)`);

  return {
    jobId: job.id,
    giftId,
    guestCount: guestEmails.length,
    status: 'queued',
  };
}

module.exports = {
  queueRegistryInvitationEmail,
  queueFundingProgressUpdateEmail,
};
