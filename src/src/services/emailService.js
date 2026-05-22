const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;


function getTransporter() {
  if (transporter) return transporter;

  if (env.smtpUser && env.smtpPass && env.smtpPass.length >= 10 && !env.smtpPass.includes('<')) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: false,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
    console.log('[Email] Gmail SMTP initialized');
  } else {
    console.warn('[Email] No valid SMTP credentials — emails will be logged to console only');
    transporter = null;
  }

  return transporter;
}


function isSmtpReady() {
  return Boolean(
    env.smtpUser &&
    env.smtpPass &&
    env.smtpPass.length >= 10 &&
    !env.smtpPass.includes('<') &&
    transporter !== null
  );
}


async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();

  if (!t) {
    console.log('\n═══════════════════════════════════════════');
    console.log(`  📧 [DEV MODE] Email to: ${to}`);
    console.log(`  📧 Subject: ${subject}`);
    console.log(`  📧 Text: ${(text || '').slice(0, 200)}`);
    console.log('═══════════════════════════════════════════\n');
    return {
      messageId: `dev-${Date.now()}`,
      to,
      subject,
    };
  }

  try {
    const info = await t.sendMail({
      from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
      to,
      subject,
      text: text || '',
      html: html || '',
    });

    console.log(`[Email] Sent to ${to}, messageId: ${info.messageId}`);
    return {
      messageId: info.messageId,
      to,
      subject,
    };
  } catch (error) {
    console.error('[Email] SMTP error:', error.message);
    throw error;
  }
}

function getVerificationHtml(code) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d4a574;">Добро пожаловать в Saukele!</h2>
      <p>Ваш код подтверждения:</p>
      <div style="
        font-size: 32px;
        font-weight: 700;
        letter-spacing: 8px;
        text-align: center;
        padding: 20px;
        background: #f8f0e6;
        border-radius: 8px;
        margin: 20px 0;
        color: #8B4513;
      ">${code}</div>
      <p>Код действителен <strong>24 часа</strong>.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">
        Если вы не регистрировались — просто проигнорируйте это письмо.
      </p>
    </div>
  `;
}

async function sendVerificationEmail(email, code) {
  console.log(`\n🔐 [EMAIL VERIFICATION CODE] for ${email}: ${code}\n`);
  return sendMail({
    to: email,
    subject: 'Подтверждение email — Saukele',
    text: `Ваш код подтверждения Saukele: ${code}`,
    html: getVerificationHtml(code),
  });
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${env.frontendUrl || 'http://localhost:5173'}/reset-password?token=${token}`;
  return sendMail({
    to: email,
    subject: 'Сброс пароля — Saukele',
    text: `Сбросить пароль: ${resetUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d4a574;">Сброс пароля</h2>
        <p>Нажмите кнопку чтобы сбросить пароль:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background: #d4a574; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Сбросить пароль
          </a>
        </div>
        <p>Ссылка действительна <strong>1 час</strong>.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">
          Если вы не запрашивали сброс — проигнорируйте это письмо.
        </p>
      </div>
    `,
  });
}

async function sendContributionConfirmationEmail(email, data) {
  return sendMail({
    to: email,
    subject: 'Подтверждение взноса — Спасибо!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d4a574;">Спасибо за ваш вклад!</h2>
        <p>Ваш взнос на <strong>${data.giftName}</strong> получен.</p>
        <div style="background: #f8f0e6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p>Сумма: <strong>${data.amount} ${data.currency}</strong></p>
        </div>
        <p>Спасибо за вашу щедрость!</p>
      </div>
    `,
  });
}

async function sendGiftFundedEmail(email, data) {
  return sendMail({
    to: email,
    subject: 'Подарок полностью собран!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d4a574;">Поздравляем!</h2>
        <p>Ваш подарок <strong>${data.giftName}</strong> полностью оплачен!</p>
        <div style="background: #f8f0e6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p>Цель: <strong>${data.targetAmount} ${data.currency}</strong></p>
        </div>
        <p>Теперь вы можете приобрести подарок.</p>
      </div>
    `,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendContributionConfirmationEmail,
  sendGiftFundedEmail,
  isSmtpReady,
  sendMail,
};