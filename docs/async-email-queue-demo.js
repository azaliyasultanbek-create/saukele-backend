/**
 * 🎯 Демо: Асинхронная очередь email-уведомлений в Redis (BullMQ)
 *
 * Демонстрирует, как 3 критических бизнес-события ставятся в очередь Redis
 * и обрабатываются воркером асинхронно (API-эндпоинт НЕ блокируется).
 *
 * 1. Приглашение в реестр (Registry Invitation)
 * 2. Обновление прогресса сбора средств (Pool Funding Progress Update)
 * 3. Подтверждение доставки подарка с учетом культурного тайминга (Gift Delivery Confirmation)
 *
 * Запуск: node docs/async-email-queue-demo.js
 * Требует: Redis на localhost:6379 (или USE_MOCK_REDIS=true)
 */

// ═══════════════════════════════════════════════════════════════════════════
// 0. ЗАГРУЗКА КОНТЕКСТА ПРОЕКТА
// ═══════════════════════════════════════════════════════════════════════════

// Используем существующую инфраструктуру проекта
process.env.USE_MOCK_REDIS = process.env.USE_MOCK_REDIS || 'true';
process.env.NODE_ENV = 'development';

const path = require('path');
const { emailQueue } = require(path.join(__dirname, '..', 'src', 'queues', 'emailQueue'));
const { redisClient, connectRedis } = require(path.join(__dirname, '..', 'src', 'config', 'redis'));
const { sendMail } = require(path.join(__dirname, '..', 'src', 'services', 'emailService'));

// ═══════════════════════════════════════════════════════════════════════════
// 1. КУЛЬТУРНЫЙ ТАЙМИНГ (Казахские свадебные традиции)
// ═══════════════════════════════════════════════════════════════════════════

const CULTURAL_DELIVERY_TIMING = {
  QUDA_TUSU: {
    code: 'quda_tusu',
    label: 'Құда түсу',
    labelRu: 'Сватовство',
    description: 'Вручение подарков при сватовстве (до свадьбы)',
    recommendedDaysBeforeWedding: 30,
    priority: 1,
  },
  BETASHAR: {
    code: 'betashar',
    label: 'Беташар',
    labelRu: 'Открытие лица невесты',
    description: 'Подарки на открытии лица невесты (обрядовые)',
    recommendedDaysBeforeWedding: 7,
    priority: 2,
  },
  TOY: {
    code: 'toy',
    label: 'Той',
    labelRu: 'Свадьба (тост)',
    description: 'Основные подарки в день свадьбы',
    recommendedDaysBeforeWedding: 0,
    priority: 3,
  },
  KUIRYK_BAUYR: {
    code: 'kuiyryk_bauyr',
    label: 'Құйрық-бауыр',
    labelRu: 'Послесвадебный этап',
    description: 'Подарки после свадьбы (угощение, быт)',
    recommendedDaysAfterWedding: 3,
    priority: 4,
  },
};

const TIER_LABELS = {
  ata_ana: 'Ата-ана (родители)',
  zhien_zaran: 'Жиен-жаран (близкие родственники)',
  kuda_zhekzhen: 'Құда-жекжат (дальние родственники)',
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════

/** Определить культурный тайминг на основе даты свадьбы */
function determineCulturalTiming(weddingDate) {
  const now = new Date();
  const daysUntilWedding = weddingDate
    ? Math.ceil((weddingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let timing;

  if (daysUntilWedding === null) {
    timing = CULTURAL_DELIVERY_TIMING.TOY;
    timing.note = 'Дата свадьбы не указана. По умолчанию — в день тоя.';
  } else if (daysUntilWedding > 14) {
    timing = CULTURAL_DELIVERY_TIMING.QUDA_TUSU;
    timing.note = `До свадьбы ${daysUntilWedding} дней. Рекомендуется вручить при құда түсу.`;
  } else if (daysUntilWedding > 3) {
    timing = CULTURAL_DELIVERY_TIMING.BETASHAR;
    timing.note = `До свадьбы ${daysUntilWedding} дней. Рекомендуется на беташар.`;
  } else if (daysUntilWedding >= 0) {
    timing = CULTURAL_DELIVERY_TIMING.TOY;
    timing.note = 'В день свадьбы — основной подарок на тое.';
  } else {
    timing = CULTURAL_DELIVERY_TIMING.KUIRYK_BAUYR;
    timing.note = `Свадьба была ${Math.abs(daysUntilWedding)} дней назад. Подарок можно вручить на құйрық-бауыр.`;
  }

  return timing;
}

/** Генерация прогресс-бара */
function generateProgressBar(percent) {
  const filled = Math.round(Math.min(percent, 100) / 5);
  const empty = 20 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent.toFixed(0)}%`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. СОБЫТИЕ 1: ПРИГЛАШЕНИЕ В РЕЕСТР (Registry Invitation)
// ═══════════════════════════════════════════════════════════════════════════

async function simulateRegistryInvitation() {
  console.log('\n' + '═'.repeat(70));
  console.log('  📧 СОБЫТИЕ 1: ПРИГЛАШЕНИЕ В РЕЕСТР (Registry Invitation)');
  console.log('═'.repeat(70));

  // Данные приглашения (как если бы пришли из API-запроса)
  const invitationData = {
    invitationId: 'inv_001',
    guestName: 'Айгуль',
    coupleName: 'Дамир и Асель',
    token: 'invite-token-abc-123',
    registerUrl: 'https://saukele.kz/register?invitation=invite-token-abc-123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    kinshipTier: 'zhien_zaran',
    kinshipTierLabel: TIER_LABELS['zhien_zaran'],
  };

  const startTime = Date.now();

  // ⚡ Ставим задачу в очередь Redis (НЕ БЛОКИРУЕМ API)
  const job = await emailQueue.add('registry-invitation', {
    type: 'registry-invitation',
    to: 'aigul@example.com',
    data: invitationData,
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
    },
  });

  const apiResponseTime = Date.now() - startTime;

  // 📤 Мгновенный ответ API (как будто пользователю)
  console.log(`\n  ⏱  API response time: ${apiResponseTime}ms ✅ (НЕ блокировали отправку!)`);
  console.log(`  📤 API ответ (201 Created):`);
  console.log(`     {`);
  console.log(`       message: "Приглашение отправлено",`);
  console.log(`       invitation: { id: "${invitationData.invitationId}", guestName: "${invitationData.guestName}", status: "pending" }`);
  console.log(`     }`);

  // 👷 Worker обработает задачу асинхронно
  console.log(`\n  👷 Job поставлен в Redis: id=${job.id}`);
  console.log(`  📬 Email будет отправлен асинхронно:`);
  console.log(`     To: aigul@example.com`);
  console.log(`     Subject: 🎉 Дамир и Асель приглашает вас в свадебный реестр Saukele!`);
  console.log(`     Body: Приглашение с кнопкой "Принять приглашение"`);
  console.log(`           Роль: ${invitationData.kinshipTierLabel}`);
  console.log(`           Ссылка: ${invitationData.registerUrl}`);

  return job;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. СОБЫТИЕ 2: ОБНОВЛЕНИЕ ПРОГРЕССА СБОРА СРЕДСТВ (Pool Funding Progress)
// ═══════════════════════════════════════════════════════════════════════════

async function simulateFundingProgressUpdate() {
  console.log('\n' + '═'.repeat(70));
  console.log('  📧 СОБЫТИЕ 2: ОБНОВЛЕНИЕ ПРОГРЕССА СБОРА (Funding Progress)');
  console.log('═'.repeat(70));

  // Данные взноса (как если бы пришли из contributionController)
  const giftData = {
    coupleId: 42,
    giftId: 101,
    giftName: 'Кофеварка DeLonghi',
    fundedAmount: 45000,
    targetAmount: 80000,
    progressPercent: (45000 / 80000) * 100,
    currency: 'KZT',
    contributorName: 'Бахыт',
    guestEmails: [
      'guest1@example.com',
      'guest2@example.com',
      'guest3@example.com',
    ],
  };

  const startTime = Date.now();

  // ⚡ Ставим задачу с deduplication (если за 30 сек будет ещё взнос — не дублируем)
  const job = await emailQueue.add('funding-progress-update', {
    type: 'funding-progress-update',
    to: null, // массовая рассылка, to не указан
    data: giftData,
    opts: {
      attempts: 2,
      deduplication: {
        id: `funding-progress-${giftData.coupleId}-${giftData.giftId}`,
        ttl: 30000, // 30 секунд дебаунс
      },
    },
  });

  const apiResponseTime = Date.now() - startTime;

  console.log(`\n  ⏱  API response time: ${apiResponseTime}ms ✅ (Мгновенно!)`);
  console.log(`  📤 API ответ (201 Created):`);
  console.log(`     { message: "Contribution successful", contribution: { id: 5001, amount: 5000, ... } }`);

  console.log(`\n  👷 Job поставлен в Redis: id=${job.id}`);
  console.log(`  📬 Массовая рассылка (${giftData.guestEmails.length} гостей):`);
  console.log(`     Subject: 📊 Прогресс сбора на «${giftData.giftName}»: ${giftData.progressPercent.toFixed(1)}%`);
  console.log(`     ${generateProgressBar(giftData.progressPercent)}`);
  console.log(`     Собрано: ${giftData.fundedAmount} ${giftData.currency} из ${giftData.targetAmount} ${giftData.currency}`);

  // Показываем deduplication
  console.log(`\n  🔄 Deduplication активен:`);
  console.log(`     Если за 30 секунд придёт ещё один взнос —`);
  console.log(`     BullMQ не создаст дубликат задачи (deduplicationId совпадает)`);

  return job;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. СОБЫТИЕ 3: ПОДТВЕРЖДЕНИЕ ДОСТАВКИ С КУЛЬТУРНЫМ ТАЙМИНГОМ
// ═══════════════════════════════════════════════════════════════════════════

async function simulateGiftDeliveryConfirmation() {
  console.log('\n' + '═'.repeat(70));
  console.log('  📧 СОБЫТИЕ 3: ПОДТВЕРЖДЕНИЕ ДОСТАВКИ ПОДАРКА');
  console.log('  (Gift Delivery Confirmation с культурным таймингом)');
  console.log('═'.repeat(70));

  // Дата свадьбы — через 10 дней (симуляция)
  const weddingDate = new Date();
  weddingDate.setDate(weddingDate.getDate() + 10);

  // Определяем культурный тайминг
  const culturalTiming = determineCulturalTiming(weddingDate);

  const deliveryData = {
    giftName: 'Сервиз чайный "Көктем"',
    coupleName: 'Дамир и Асель',
    deliveredAt: new Date(),
    culturalTiming,
    handlingFlags: ['FRAGILE', 'VALUABLE'],
    deliveryNote: 'Обращаться с осторожностью! Хрупкий груз. | Ценный груз! Страховка обязательна. Подпись при получении.',
    packagingRequirements: {
      requiresPackaging: true,
      packagingReason: 'Требуется специальная упаковка: Хрупкое, Ценное.',
    },
    logisticsManifest: {
      manifestVersion: '1.0',
      gift: 'Сервиз чайный "Көктем"',
      flags: ['FRAGILE', 'VALUABLE'],
      specialTransport: false,
      insurance: true,
      signatureRequired: true,
    },
    guestEmails: ['ata@example.com', 'guest2@example.com'],
  };

  const startTime = Date.now();

  // ⚡ Ставим задачу в очередь (с высоким приоритетом)
  const job = await emailQueue.add('gift-delivery-confirmation', {
    type: 'gift-delivery-confirmation',
    to: 'damir.assel@example.com',
    ccGuests: true,
    data: deliveryData,
    opts: {
      attempts: 3,
      priority: 1, // высокий приоритет
      delay: 0,
    },
  });

  const apiResponseTime = Date.now() - startTime;

  console.log(`\n  🗓  Дата свадьбы: ${weddingDate.toLocaleDateString('ru-KZ')}`);
  console.log(`  🎎 Культурный тайминг: ${culturalTiming.label} (${culturalTiming.labelRu})`);
  console.log(`     ${culturalTiming.description}`);
  console.log(`     📌 ${culturalTiming.note}`);

  console.log(`\n  ⏱  API response time: ${apiResponseTime}ms ✅`);
  console.log(`  📤 API ответ:`);
  console.log(`     {`);
  console.log(`       message: "Gift delivery confirmed",`);
  console.log(`       gift: { name: "${deliveryData.giftName}", status: "delivered",`);
  console.log(`               deliveryTiming: "${culturalTiming.label} (${culturalTiming.labelRu})" }`);
  console.log(`     }`);

  console.log(`\n  👷 Job поставлен в Redis: id=${job.id} (приоритет: высокий)`);
  console.log(`  📬 Email паре (${deliveryData.coupleName}):`);
  console.log(`     Subject: ✅ Подтверждение доставки подарка «${deliveryData.giftName}»`);
  console.log(`     ${culturalTiming.label} — ${culturalTiming.note}`);

  if (deliveryData.handlingFlags.length) {
    console.log(`\n  📦 Флаги транспортировки:`);
    deliveryData.handlingFlags.forEach(f => console.log(`     • ${f}`));
    console.log(`     Заметка: ${deliveryData.deliveryNote}`);
    console.log(`     Упаковка: ${deliveryData.packagingRequirements.packagingReason}`);
  }

  if (deliveryData.ccGuests) {
    console.log(`\n  👥 Копии гостям (${deliveryData.guestEmails.length}):`);
    deliveryData.guestEmails.forEach(e => console.log(`     • ${e}`));
    console.log(`     Subject: 🎁 Подарок «${deliveryData.giftName}» доставлен!`);
  }

  return job;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. ЗАПУСК ДЕМО
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║  🚀 Saukele: Асинхронная очередь email-уведомлений в Redis    ║');
  console.log('║  BullMQ + Redis — 3 критических бизнес-события              ║');
  console.log('╚' + '═'.repeat(68) + '╝');

  // Подключаемся к Redis (или используем Mock)
  await connectRedis();
  const redisMode = redisClient.constructor.name === 'MockRedisClient' ? 'MOCK' : 'REAL';
  console.log(`\n  📡 Redis connection: ${redisMode}`);

  // Путь очереди
  console.log(`  📬 Email Queue: ${emailQueue.constructor.name}`);
  console.log(`     (jobs будут обработаны асинхронно работником)`);

  // ── Запускаем 3 события ────────────────────────────────────────────
  const job1 = await simulateRegistryInvitation();
  const job2 = await simulateFundingProgressUpdate();
  const job3 = await simulateGiftDeliveryConfirmation();

  // ── Итог ───────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('  📊 ИТОГ: 3 бизнес-события поставлены в очередь');
  console.log('═'.repeat(70));

  console.log(`
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │   "API-эндпоинт НЕ БЛОКИРУЕТ ответ пользователю" —                 │
  │   это ключевое преимущество асинхронной очереди:                   │
  │                                                                     │
  │   • Время ответа API: <10ms (только постановка в Redis)             │
  │   • Вместо: 2-5 секунд ожидания SMTP                               │
  │   • Надёжность: Redis хранит задачу даже если Worker временно упал  │
  │   • Retry: встроен (attempts, backoff)                             │
  │   • Debounce: deduplicationId предотвращает спам уведомлений        │
  │   • Масштабирование: N workers = параллельная обработка             │
  │                                                                     │
  │   1. Приглашение в реестр:  ${job1.id}                        │
  │   2. Прогресс сбора:        ${job2.id}                        │
  │   3. Доставка с таймингом:  ${job3.id}                        │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
  `);

  // Показываем статус очереди
  const counts = await emailQueue.getJobCounts();
  console.log(`  📊 Статус очереди:`);
  console.log(`     Waiting: ${counts.waiting || 0}`);
  console.log(`     Active:  ${counts.active || 0}`);
  console.log(`     Completed: ${counts.completed || 0}`);
  console.log(`     Failed:  ${counts.failed || 0}`);

  // В реальном проекте очередь обрабатывает emailWorker.js
  console.log(`\n  👷 В реальном проекте worker запускается отдельно:`);
  console.log(`     $ npm run worker:email`);

  console.log('\n  ✅ Демо завершено! Все 3 события в очереди.\n');

  // Закрываем соединение с Redis
  await emailQueue.close();
}

main().catch(console.error);
