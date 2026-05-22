// Lazy import — bullmq may not be available; we use MockQueue
let BullQueue;
try {
  BullQueue = require('bullmq').Queue;
} catch (e) {
  // bullmq not available, will use MockEmailQueue
}

// Get redis client lazily — will be replaced with MockRedis if connection fails
const getRedisClient = () => {
  const { redisClient } = require('../config/redis');
  return redisClient;
};

const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendContributionConfirmationEmail,
  sendGiftFundedEmail,
  sendRegistryInvitationEmail,
  sendMail,
  isSmtpReady
} = require('../services/emailService');

// ─── Вспомогательные функции для новых типов (синхронная отправка в Mock) ─

async function sendFundingProgressUpdateEmail(data) {
  const subject = `📊 Прогресс: ${data.giftName} — ${(data.progressPercent || 0).toFixed(1)}%`;
  const recipients = data.guestEmails || [];
  for (const guestEmail of recipients) {
    await sendMail({ to: guestEmail, subject, html: `<p>${data.contributorName} внёс вклад. Собрано ${data.fundedAmount} ${data.currency} из ${data.targetAmount} ${data.currency}</p>` });
  }
}

async function sendGiftDeliveryConfirmationEmail(email, data) {
  const isGuest = data.isGuestCopy;
  const subject = isGuest ? `🎁 Подарок «${data.giftName}» доставлен!` : `✅ Доставка «${data.giftName}» подтверждена`;
  const timingInfo = data.culturalTiming ? `${data.culturalTiming.label} (${data.culturalTiming.labelRu}): ${data.culturalTiming.timingNote || data.culturalTiming.note || ''}` : '';
  await sendMail({ to: email, subject, html: `<p>${timingInfo}</p><p>Доставлено: ${new Date(data.deliveredAt || Date.now()).toLocaleString('ru-KZ')}</p>` });
}

// ─── Основная функция отправки ─────────────────────────────────────────
async function sendEmailJobNow(data) {
  switch (data.type) {
    // Существующие типы
    case 'verification':
      await sendVerificationEmail(data.to, data.data.code);
      break;
    case 'password-reset':
      await sendPasswordResetEmail(data.to, data.data.token);
      break;
    case 'contribution-confirmation':
      await sendContributionConfirmationEmail(data.to, data.data);
      break;
    case 'gift-funded':
      await sendGiftFundedEmail(data.to, data.data);
      break;

    // НОВЫЕ типы
    case 'registry-invitation':
      await sendRegistryInvitationEmail(data.to, data.data);
      break;
    case 'funding-progress-update':
      await sendFundingProgressUpdateEmail(data.data);
      break;
    case 'gift-delivery-confirmation':
      await sendGiftDeliveryConfirmationEmail(data.to, data.data);
      if (data.data.ccGuests && Array.isArray(data.data.guestEmails)) {
        for (const guestEmail of data.data.guestEmails) {
          await sendGiftDeliveryConfirmationEmail(guestEmail, { ...data.data, isGuestCopy: true });
        }
      }
      break;

    default:
      throw new Error(`Unknown email job type: ${data.type}`);
  }
}

// ─── Mock Queue ────────────────────────────────────────────────────────

class MockEmailQueue {
  constructor() {
    this.counts = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0
    };
  }

  async add(jobName, data) {
    console.log(`[Mock Email] ${jobName}:`, data.type, 'to:', data.to);
    this.counts.active += 1;

    try {
      if (isSmtpReady()) {
        console.log('[Mock Email] Gmail SMTP is configured — sending via Gmail');
      } else {
        console.log('[Mock Email] No SMTP credentials — logging to console only');
      }
      await sendEmailJobNow(data);
      console.log(`[Direct Email] ${jobName} sent` + (data.to ? ` to ${data.to}` : ''));
      this.counts.completed += 1;
    } catch (error) {
      console.log(`[Direct Email] failed: ${error.message}`);
      this.counts.completed += 1;
    } finally {
      this.counts.active -= 1;
    }

    return { id: Date.now() };
  }

  async getJobCounts() {
    return { ...this.counts };
  }

  async close() {}
}

const useMockQueue = process.env.USE_MOCK_REDIS === 'true';

const emailQueue = useMockQueue
  ? new MockEmailQueue()
  : new BullQueue('emails', { connection: getRedisClient() });

module.exports = { emailQueue };

