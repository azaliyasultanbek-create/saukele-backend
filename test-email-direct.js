
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function test() {
  

  try {
    const { sendRegistryInvitationEmail } = require('./src/services/emailService');

    console.log('✅ Модуль emailService загружен');
    console.log('   sendRegistryInvitationEmail —', typeof sendRegistryInvitationEmail);
    console.log('');

   
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

    


  } catch (error) {
    console.error('\n❌ Ошибка теста:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
