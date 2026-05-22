const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const nodemailer = require('nodemailer');

async function main() {

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: '"Saukele" <' + process.env.SMTP_FROM_EMAIL + '>',
    to: 'azisultanbek47@gmail.com',
    subject: 'Тест Saukele: проверка доставки',
    priority: 'high',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2 style="color: #d4a574;">Привет! 👋</h2>
        <p>Это тестовое письмо для проверки, попадают ли письма от Saukele в спам.</p>
        <p style="color: #666; font-size: 12px;">
          Если это письмо в папке "Входящие" — всё работает!<br>
          Если в спаме — нажмите "Не спам", чтобы отметить.
        </p>
        <p>Проверьте папку <strong>Спам</strong>!</p>
      </div>
    `,
  });
  
  console.log('Sent! ID:', info.messageId);
  console.log('Accepted:', info.accepted);
  console.log('Response:', info.response);
  
  
  console.log('\n--- Отправка как из familyController ---\n');
  
  const info2 = await transporter.sendMail({
    from: '"Saukele" <' + process.env.SMTP_FROM_EMAIL + '>',
    to: 'azisultanbek47@gmail.com',
    subject: 'dari & azi priglashaet vas v svadebnyj reestr Saukele!',
    priority: 'high',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f0e6; border-radius: 12px; padding: 40px 30px; text-align: center;">
          <h1 style="color: #8B4513; margin: 0 0 10px;">Priglashnie v reestr!</h1>
          <p style="font-size: 18px; color: #333; margin: 20px 0;">Zdravstvujte!</p>
          <p style="font-size: 16px; color: #555; line-height: 1.6;">
            <strong style="color: #8B4513;">dari & azi</strong> priglashaet vas
            prisoodinitsya k ih svadebnomu reestru podarkov na <strong>Saukele</strong>.
          </p>
          <p style="color: #999; font-size: 13px; margin-top: 20px;">
            Esli vy ne ozhidali etogo priglasheniya, prosto proignorirujte eto pismo.
          </p>
        </div>
      </div>
    `,
  });
  
  console.log('Sent2! ID:', info2.messageId);
}

main().catch(console.error);
