const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const nodemailer = require('nodemailer');

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const testEmails = [
    'azisultanbek47@gmail.com',
    'sultanbekazalia0@gmail.com',
  ];

  for (const email of testEmails) {
    try {
      const info = await transporter.sendMail({
        from: '"Saukele" <' + process.env.SMTP_FROM_EMAIL + '>',
        to: email,
        subject: 'Приглашение на свадьбу от Saukele',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #d4a574;">Приглашение на свадьбу! 🎉</h2>
            <p>Здравствуйте!</p>
            <p>Пара <strong>Иван и Алия</strong> приглашает вас посмотреть их свадебный реестр подарков.</p>
            <p>Вы были добавлены как <strong>Ата-ана (родители и старшие)</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?invitedBy=1" 
                 style="background: #d4a574; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 16px;">
                💝 Посмотреть подарки
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">
              Если вы не ожидали этого приглашения, просто проигнорируйте это письмо.
            </p>
          </div>
        `,
      });
      console.log(`✅ Письмо отправлено на ${email}`);
      console.log(`   messageId: ${info.messageId}`);
    } catch (err) {
      console.error(`❌ Ошибка отправки на ${email}: ${err.message}`);
    }
  }
}

main();
