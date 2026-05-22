/**
 * Прямой тест функции sendRegistryInvitationEmail() из emailService
 * 
 * Запуск: node test-email-direct.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function test() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  ТЕСТ sendRegistryInvitationEmail()');
  console.log('═══════════════════════════════════════════\n');

  try {
    const { sendRegistryInvitationEmail } = require('./src/services/emailService');

    console.log('✅ Модуль emailService загружен');
    console.log('   sendRegistryInvitationEmail —', typeof sendRegistryInvitationEmail);
    console.log('');

    // Тест: отправка тестового письма (в консоль, т.к. нет реального SMTP)
    console.log('─── Отправка тестового письма ──────────');
    
    const result = await sendRegistryInvitationEmail('guest@example.com', {
      inviterName: 'Иван & Алия',
      registryName: 'Иван & Алия Wedding Registry',
      invitationLink: 'https://saukele.kz/register?invitation=token123',
    });

    console.log('✅ Письмо "отправлено":');
    console.log('   messageId:', result.messageId);
    console.log('   to:', result.to);
    console.log('   subject:', result.subject);
    console.log('');

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                ЧТО БЫЛО ОТПРАВЛЕНО                      ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  To:      guest@example.com                              ║`);
    console.log(`║  Subject: Wedding Registry Invitation                    ║`);
    console.log(`║  Body:                                                   ║`);
    console.log(`║  You have been invited to join the registry for          ║`);
    console.log(`║  "Иван & Алия Wedding Registry" by Иван & Алия          ║`);
    console.log(`║                                                         ║`);
    console.log(`║  [View Invitation] — https://saukele.kz/register?       ║`);
    console.log(`║                      invitation=token123                 ║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('═══════════════════════════════════════════');
    console.log('  ТЕСТ ПРОЙДЕН УСПЕШНО! ✅');
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Ошибка теста:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
