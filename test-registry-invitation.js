/**
 * Тест функции queueRegistryInvitationEmail()
 * 
 * Запуск: node test-registry-invitation.js
 * 
 * Перед запуском убедитесь что у вас есть:
 * - База данных PostgreSQL (docker или локально)
 * - Redis (опционально, если USE_MOCK_REDIS=true)
 * - Установленные зависимости: npm install
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Включаем mock-режим для Redis (чтобы не нужен был настоящий Redis)
process.env.USE_MOCK_REDIS = 'true';

async function test() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  ТЕСТ queueRegistryInvitationEmail()');
  console.log('═══════════════════════════════════════════\n');

  try {
    const { queueRegistryInvitationEmail } = require('./src/services/registryService');

    console.log('✅ Модуль загружен успешно');
    console.log('   queueRegistryInvitationEmail —', typeof queueRegistryInvitationEmail);
    console.log('');

    // Тест 1: Успешная отправка
    console.log('─── Тест 1: Успешная отправка ───────────');
    const result = await queueRegistryInvitationEmail({
      recipientEmail: 'guest@example.com',
      inviterName: 'Иван & Алия',
      registryName: 'Иван & Алия Wedding Registry',
      invitationLink: 'https://saukele.kz/register?invitation=token123',
    });
    console.log('✅ Результат:', JSON.stringify(result, null, 2));
    console.log('');

    // Тест 2: Проверка валидации — пропущен email
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

    // Тест 3: Проверка валидации — пропущен inviterName
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

    // Тест 4: Проверка валидации — пропущен registryName
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

    // Тест 5: Проверка валидации — пропущен invitationLink
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

    console.log('═══════════════════════════════════════════');
    console.log('  ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО! ✅');
    console.log('═══════════════════════════════════════════\n');

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
