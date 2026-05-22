

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });


process.env.USE_MOCK_REDIS = 'true';

async function test() {
  

  try {
    const { queueRegistryInvitationEmail } = require('./src/services/registryService');

    console.log('✅ Модуль загружен успешно');
    console.log('   queueRegistryInvitationEmail —', typeof queueRegistryInvitationEmail);
    console.log('');

   
    console.log('─── Тест 1: Успешная отправка ───────────');
    const result = await queueRegistryInvitationEmail({
      recipientEmail: 'guest@example.com',
      inviterName: 'Иван & Алия',
      registryName: 'Иван & Алия Wedding Registry',
      invitationLink: 'https://saukele.kz/register?invitation=token123',
    });
    console.log('✅ Результат:', JSON.stringify(result, null, 2));
    console.log('');

   
    console.log('─── Тест 2: Ошибка — нет email ──────────');
    try {
      await queueRegistryInvitationEmail({
        inviterName: 'Иван & Алия',
        registryName: 'Иван & Алия Wedding Registry',
        invitationLink: 'https://saukele.kz/register?invitation=token123',
      });
      console.log('❌ Ошибка: не выбросило исключение');
    } catch (err) {
      console.log('✅ Ожидаемая ошибка:', err.message);
    }
    console.log('');

    
    console.log('─── Тест 3: Ошибка — нет inviterName ────');
    try {
      await queueRegistryInvitationEmail({
        recipientEmail: 'guest@example.com',
        registryName: 'Иван & Алия Wedding Registry',
        invitationLink: 'https://saukele.kz/register?invitation=token123',
      });
      console.log('❌ Ошибка: не выбросило исключение');
    } catch (err) {
      console.log('✅ Ожидаемая ошибка:', err.message);
    }
    console.log('');

   
    console.log('─── Тест 4: Ошибка — нет registryName ───');
    try {
      await queueRegistryInvitationEmail({
        recipientEmail: 'guest@example.com',
        inviterName: 'Иван & Алия',
        invitationLink: 'https://saukele.kz/register?invitation=token123',
      });
      console.log('❌ Ошибка: не выбросило исключение');
    } catch (err) {
      console.log('✅ Ожидаемая ошибка:', err.message);
    }
    console.log('');

   
    console.log('─── Тест 5: Ошибка — нет invitationLink ─');
    try {
      await queueRegistryInvitationEmail({
        recipientEmail: 'guest@example.com',
        inviterName: 'Иван & Алия',
        registryName: 'Иван & Алия Wedding Registry',
      });
      console.log('❌ Ошибка: не выбросило исключение');
    } catch (err) {
      console.log('✅ Ожидаемая ошибка:', err.message);
    }
    console.log('');

    

    console.log('📧 Письмо в mock-режиме:');
    console.log('   Так как USE_MOCK_REDIS=true, письмо НЕ отправляется реально.');
    console.log('   Вместо этого оно выводится в консоль.');
    console.log('');
    console.log('   Тема: "Wedding Registry Invitation"');
    console.log('   Текст: "You have been invited to join the registry for');
    console.log('           Иван & Алия Wedding Registry by Иван & Алия"');
    console.log('');

  } catch (error) {
    console.error('\n❌ Ошибка теста:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
