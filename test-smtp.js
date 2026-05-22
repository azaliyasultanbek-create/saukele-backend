const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const nodemailer = require('nodemailer');

async function main() {
  console.log('=== ПРОВЕРКА SMTP ===');
  console.log('SMTP_HOST:', process.env.SMTP_HOST || 'НЕ ЗАДАН');
  console.log('SMTP_PORT:', process.env.SMTP_PORT || 'НЕ ЗАДАН');
  console.log('SMTP_USER:', process.env.SMTP_USER || 'НЕ ЗАДАН');
  console.log('SMTP_PASS задан:', process.env.SMTP_PASS ? 'да (длина ' + process.env.SMTP_PASS.length + ')' : 'НЕТ');
  console.log('SMTP_FROM_EMAIL:', process.env.SMTP_FROM_EMAIL || 'НЕ ЗАДАН');
  console.log('');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log('Подключаюсь к SMTP...');
    await transporter.verify();
    console.log('SMTP соединение успешно!\n');
  } catch (err) {
    console.error('Ошибка подключения к SMTP:', err.message);
    console.log('Продолжаю попытку отправки...\n');
  }

  try {
    const info = await transporter.sendMail({
      from: '"Saukele" <' + process.env.SMTP_FROM_EMAIL + '>',
      to: 'sultanbekazalia0@gmail.com',
      subject: 'Тест Saukele SMTP',
      html: '<h1>Тест</h1><p>Проверка отправки с Saukele.</p>',
    });
    console.log('Письмо отправлено!');
    console.log('messageId:', info.messageId);
    console.log('response:', info.response);
  } catch (err) {
    console.error('Ошибка отправки:', err.message);
    console.error('Код ошибки:', err.code);
    
    if (err.code === 'EAUTH') {
      console.log('\nПроблема: Неверный пароль или требуется пароль приложения.');
      console.log('Для Gmail сделайте:');
      console.log('1. Включите 2-факторную аутентификацию в Google аккаунте');
      console.log('2. Создайте "пароль приложения": https://myaccount.google.com/apppasswords');
      console.log('3. Используйте этот пароль в .env как SMTP_PASS');
    }
  }
}

main();
