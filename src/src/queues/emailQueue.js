const { Queue } = require('bullmq');
const getRedisClient = () => {
  const { redisClient } = require('../config/redis');
  return redisClient;
};

const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendContributionConfirmationEmail,
  sendGiftFundedEmail,
  sendMail,
  isSmtpReady
} = require('../services/emailService');


const TIER_LABELS = {
  ata_ana: 'Ата-ана (родители)',
  zhien_zaran: 'Жиен-жаран (близкие родственники)',
  kuda_zhekzhen: 'Құда-жекжат (дальние родственники)',
};

async function sendRegistryInvitationEmail(email, data) {
  const subject = `🎉 ${data.coupleName} приглашает вас в свадебный реестр Saukele!`;
  const html = `<p>Приглашение от ${data.coupleName}. Роль: ${TIER_LABELS[data.kinshipTier] || data.kinshipTier}. Ссылка: ${data.registerUrl}</p>`;
  return sendMail({ to: email, subject, html });
}

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



async function sendEmailJobNow(data) {
  switch (data.type) {
  
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
  : new Queue('emails', { connection: getRedisClient() });

module.exports = { emailQueue };
