const { Worker } = require('bullmq');
const { redisClient } = require('../config/redis');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendContributionConfirmationEmail,
  sendGiftFundedEmail,
  sendMail
} = require('../services/emailService');

// ─── Вспомогательные функции (для новых типов писем) ─────────────────

const TIER_LABELS = {
  ata_ana: 'Ата-ана (родители)',
  zhien_zaran: 'Жиен-жаран (близкие родственники)',
  kuda_zhekzhen: 'Құда-жекжат (дальние родственники)',
};

async function sendRegistryInvitationEmail(email, data) {
  const subject = `🎉 ${data.coupleName} приглашает вас в свадебный реестр Saukele!`;
  const registerUrl = data.registerUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?invitation=${data.token}`;
  const tierLabel = TIER_LABELS[data.kinshipTier] || data.kinshipTierLabel || data.kinshipTier;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d4a574;">Приглашение в реестр</h2>
      <p>Здравствуйте, <strong>${data.guestName}</strong>!</p>
      <p><strong>${data.coupleName}</strong> приглашает вас присоединиться к их свадебному реестру в <strong>Saukele</strong>.</p>
      <p>Ваша роль: <em>${tierLabel}</em></p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${registerUrl}"
           style="background: #d4a574; color: white; padding: 14px 36px; border-radius: 6px;
                  text-decoration: none; font-weight: bold; font-size: 16px;">
          Принять приглашение
        </a>
      </div>
      <p style="color: #888; font-size: 12px;">
        Ссылка действительна до ${data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('ru-KZ') : '7 дней'}.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">
        Если вы не ожидали этого приглашения — проигнорируйте это письмо.
      </p>
    </div>
  `;

  return sendMail({ to: email, subject, html });
}

async function sendFundingProgressUpdateEmail(data) {
  const subject = `📊 Прогресс сбора на «${data.giftName}»: ${(data.progressPercent || 0).toFixed(1)}%`;
  const percent = Math.min(data.progressPercent || 0, 100);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d4a574;">Обновление прогресса</h2>
      <p><strong>${data.contributorName}</strong> внёс вклад в подарок <strong>${data.giftName}</strong>!</p>
      <div style="background: #f8f0e6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;">
          Собрано: <strong>${data.fundedAmount} ${data.currency}</strong>
          из <strong>${data.targetAmount} ${data.currency}</strong>
        </p>
        <div style="background: #e0ddd7; border-radius: 10px; padding: 2px; margin: 10px 0;">
          <div style="background: linear-gradient(90deg, #d4a574, #c49565); width: ${percent}%; height: 20px; border-radius: 8px;"></div>
        </div>
        <p style="margin: 5px 0 0; text-align: center; font-size: 14px;"><strong>${percent.toFixed(1)}%</strong></p>
      </div>
      <p style="color: #888; font-size: 12px;">Вы получили это письмо, так как участвуете в сборе средств на подарок.</p>
    </div>
  `;

  const results = [];
  const recipients = data.guestEmails || [];
  
  for (const guestEmail of recipients) {
    try {
      const result = await sendMail({ to: guestEmail, subject, html });
      results.push({ email: guestEmail, sent: true, messageId: result.messageId });
    } catch (err) {
      console.error(`[FundingProgress] Failed to send to ${guestEmail}: ${err.message}`);
      results.push({ email: guestEmail, sent: false, error: err.message });
    }
  }

  return results;
}

async function sendGiftDeliveryConfirmationEmail(email, data) {
  const isGuest = data.isGuestCopy;
  const subject = isGuest
    ? `🎁 Подарок «${data.giftName}» доставлен!`
    : `✅ Подтверждение доставки подарка «${data.giftName}»`;

  const culturalSection = data.culturalTiming ? `
    <div style="background: #f0e6d8; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #d4a574;">
      <h3 style="margin: 0 0 8px; color: #8B4513;">🎎 Культурный тайминг</h3>
      <p style="margin: 4px 0;"><strong>${data.culturalTiming.label}</strong> (${data.culturalTiming.labelRu})</p>
      <p style="margin: 4px 0; color: #666;">${data.culturalTiming.description}</p>
      <p style="margin: 8px 0 0; font-style: italic; color: #8B4513;">📌 ${data.culturalTiming.timingNote || data.culturalTiming.note || ''}</p>
    </div>
  ` : '';

  const handlingSection = data.handlingFlags?.length ? `
    <div style="background: #fff8ee; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #c49565;">
      <h4 style="margin: 0 0 8px; color: #666;">📋 Логистическая информация</h4>
      <p style="margin: 4px 0;"><strong>Заметка при доставке:</strong> ${data.deliveryNote || '—'}</p>
      <p style="margin: 4px 0;"><strong>Упаковка:</strong> ${data.packagingRequirements?.packagingReason || 'Стандартная'}</p>
    </div>
  ` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d4a574;">${isGuest ? '🎁 Подарок доставлен!' : '✅ Доставка подтверждена'}</h2>
      <p>${isGuest
        ? `Подарок <strong>«${data.giftName}»</strong> для молодых был успешно доставлен!`
        : `Подарок <strong>«${data.giftName}»</strong> подтверждён как доставленный.`
      }</p>
      <p style="color: #888;">Доставлено: ${data.deliveredAt ? new Date(data.deliveredAt).toLocaleString('ru-KZ') : new Date().toLocaleString('ru-KZ')}</p>
      ${culturalSection}
      ${handlingSection}
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Спасибо, что пользуетесь <strong>Saukele</strong>! 🎉</p>
    </div>
  `;

  return sendMail({ to: email, subject, html });
}

// ─── Worker ──────────────────────────────────────────────────────────

const worker = new Worker('emails', async (job) => {
  const { type, to, data } = job.data;

  console.log(`[Worker] Processing job ${job.id}: ${type}`);

  switch (type) {
    // ─── Существующие типы ────────────────────────────────────────
    case 'verification':
      await sendVerificationEmail(to, data.code);
      break;

    case 'password-reset':
      await sendPasswordResetEmail(to, data.token);
      break;

    case 'contribution-confirmation':
      await sendContributionConfirmationEmail(to, data);
      break;

    case 'gift-funded':
      await sendGiftFundedEmail(to, data);
      break;

    // ─── НОВЫЕ: 3 бизнес-события ─────────────────────────────────

    case 'registry-invitation':
      await sendRegistryInvitationEmail(to, data);
      break;

    case 'funding-progress-update':
      await sendFundingProgressUpdateEmail(data);
      break;

    case 'gift-delivery-confirmation':
      // Отправляем паре
      await sendGiftDeliveryConfirmationEmail(to, data);
      // Если есть флаг ccGuests — отправляем копии гостям
      if (data.ccGuests && Array.isArray(data.guestEmails)) {
        for (const guestEmail of data.guestEmails) {
          await sendGiftDeliveryConfirmationEmail(guestEmail, {
            ...data,
            isGuestCopy: true,
          });
        }
      }
      break;

    default:
      throw new Error(`Unknown email job type: ${type}`);
  }

  console.log(`[Worker] Job ${job.id} (${type}) completed`);
}, {
  connection: redisClient,
  concurrency: 5,
});

worker.on('completed', (job) => {
  console.log(`✅ [Worker] Job ${job.id} (${job.data.type}) completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [Worker] Job ${job?.id} (${job?.data?.type}) failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('❌ [Worker] Error:', err.message);
});

console.log('📧 Email Worker started, waiting for jobs...');
