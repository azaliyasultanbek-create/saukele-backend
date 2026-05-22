/**
 * Тест queueFundingProgressUpdateEmail()
 *
 * Запуск: node test-funding-progress.js
 */
require('dotenv').config();
const { queueFundingProgressUpdateEmail } = require('./src/services/registryService');

async function test() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  ТЕСТ queueFundingProgressUpdateEmail()');
  console.log('═══════════════════════════════════════════\n');

  try {
    console.log('─── Тест 1: Прямой вызов с тестовыми данными ───\n');

    const result = await queueFundingProgressUpdateEmail({
      coupleId: 1,          // замените на реальный coupleId из БД
      giftId: 1,            // замените на реальный giftId
      giftName: 'Тестовый подарок',
      fundedAmount: 50000,
      targetAmount: 100000,
      currency: 'KZT',
      progressPercent: 50,
      contributorName: 'Азат',
      contributorId: 2,     // ID того, кто сделал взнос (исключится из списка)
    });

    console.log(`\n✅ Результат:`);
    console.log(JSON.stringify(result, null, 2));
    console.log(`\n   Статус: ${result.status}`);
    if (result.guestCount) {
      console.log(`   Гостей уведомлено: ${result.guestCount}`);
    }

  } catch (error) {
    console.error(`\n❌ Ошибка:`, error.message);
    console.error(error);
  }
}

test().finally(() => process.exit());
