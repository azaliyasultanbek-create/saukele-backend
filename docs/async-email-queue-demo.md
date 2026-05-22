# Асинхронная очередь email-уведомлений в Redis (BullMQ)

## Архитектура

```
┌────────────────────┐     ┌──────────┐     ┌─────────────────────┐
│   API Controller   │ ──► │   Redis  │ ──► │  Email Worker       │
│   (express route)  │     │  (queue) │     │  (bullmq Worker)    │
│                    │     │          │     │                     │
│  • Регистрация      │     │  BullMQ  │     │  • sendVerification │
│  • Взнос            │     │  Queue   │     │  • sendContribution │
│  • Достижение цели  │     │          │     │  • sendGiftFunded   │
└────────────────────┘     └──────────┘     └─────────────────────┘
       ▲                        │                      │
       │  Мгновенный            │  Job.queue()          │  Асинхронно
       │  ответ 201/200         │  (не блокирует API)   │  обрабатывает
       └────────────────────────┘                      └──────────────┘
```

## 3 критических бизнес-события

### 1. Приглашение в реестр (Registry Invitation)

Когда пара приглашает гостя зарегистрироваться в системе, отправляется email-приглашение со ссылкой на регистрацию и уникальным токеном.

**Где ставится в очередь:** `familyController.js` (при добавлении гостя в FamilyTree)

**Тип job'а:** `'registry-invitation'`

```javascript
// src/controllers/familyController.js
const { emailQueue } = require('../queues/emailQueue');

async function inviteGuestToRegistry(req, res) {
  const { guestPhone, guestName, kinshipTier } = req.body;
  const coupleId = req.user.id;

  // 1. Создаём приглашение в БД
  const invitation = await prisma.registryInvitation.create({
    data: {
      coupleId,
      guestPhone,
      guestName,
      kinshipTier,
      token: crypto.randomUUID(),
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
    },
  });

  // 2. Ставим задачу в Redis-очередь — НЕ БЛОКИРУЕМ ОТВЕТ
  await emailQueue.add('registry-invitation', {
    type: 'registry-invitation',
    to: `${guestPhone}@sms-gateway`, // или email, если известен
    data: {
      invitationId: invitation.id,
      guestName,
      coupleName: req.user.fullName,
      token: invitation.token,
      registerUrl: `${env.frontendUrl}/register?invitation=${invitation.token}`,
      expiresAt: invitation.expiresAt,
      kinshipTier,
      kinshipTierLabel: TIER_LABELS[kinshipTier],
    },
    opts: {
      attempts: 3,           // 3 попытки при ошибке
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,  // хранить не более 100 завершённых
    },
  });

  // 3. Мгновенный ответ пользователю
  return res.status(201).json({
    message: 'Приглашение отправлено',
    invitation: {
      id: invitation.id,
      guestName,
      kinshipTier,
      status: 'pending',
    },
  });
}
```

---

### 2. Обновление прогресса сбора средств (Pool Funding Progress Update)

Когда гость делает взнос, все остальные гости получают уведомление о прогрессе сбора. Уведомление приходит не каждому гостю синхронно, а асинхронно и с дебаунсом.

**Где ставится в очередь:** `contributionController.js` (после успешного взноса)

**Тип job'а:** `'funding-progress-update'`

```javascript
// src/controllers/contributionController.js (расширение)
const { emailQueue } = require('../queues/emailQueue');

async function createContribution(req, res) {
  // ... существующая логика создания взноса ...

  // После успешного создания взноса:

  // 2a. Отправляем подтверждение самому гостю (мгновенно в очередь)
  if (req.user.email) {
    await emailQueue.add('contribution-confirmation', {
      type: 'contribution-confirmation',
      to: req.user.email,
      data: {
        giftName: result.gift.name,
        amount: result.contribution.originalAmount,
        currency: result.contribution.currencyUsed,
      },
    });
  }

  // 2b. Оповещаем ВСЕХ гостей о прогрессе сбора (асинхронно)
  const allGuests = await prisma.familyTree.findMany({
    where: { coupleId: result.gift.coupleId },
    include: { guest: { select: { email: true, id: true } } },
  });

  const progressPercent = (result.gift.fundedAmount / result.gift.targetAmount) * 100;

  // Ставим одну "общую" задачу, которая внутри переберёт гостей
  await emailQueue.add('funding-progress-update', {
    type: 'funding-progress-update',
    data: {
      coupleId: result.gift.coupleId,
      giftId: result.gift.id,
      giftName: result.gift.name,
      fundedAmount: result.gift.fundedAmount,
      targetAmount: result.gift.targetAmount,
      progressPercent,
      currency: result.gift.currency,
      contributorName: req.user.fullName,
      guestEmails: allGuests
        .filter(fe => fe.guest.email && fe.guest.id !== req.user.id)
        .map(fe => fe.guest.email),
    },
    opts: {
      attempts: 2,
      // Debounce: если за 30 секунд придёт ещё один взнос,
      // BullMQ deduplicationId позволит избежать дублирования
      deduplication: {
        id: `funding-progress-${result.gift.coupleId}-${result.gift.id}`,
        ttl: 30000,
      },
    },
  });

  // 2c. Если подарок полностью собран — оповещаем пару
  if (result.gift.status === 'funded') {
    const couple = await prisma.coupleProfile.findUnique({
      where: { coupleId: result.gift.coupleId },
      include: { user: true },
    });

    if (couple?.user?.email) {
      await emailQueue.add('gift-funded', {
        type: 'gift-funded',
        to: couple.user.email,
        data: {
          giftName: result.gift.name,
          targetAmount: result.gift.targetAmount,
          currency: result.gift.currency,
        },
      });
    }
  }

  // 3. Мгновенный ответ
  return res.status(201).json({
    message: 'Contribution successful',
    // ... остальной ответ ...
  });
}
```

---

### 3. Подтверждение доставки подарка с учетом культурного тайминга (Gift Delivery Confirmation)

В казахской традиции дарение подарков имеет культурный тайминг: «құда түсу» (сватовство), «беташар» (открытие лица невесты), «той» (свадьба), «құйрық-бауыр ету» и другие этапы. Доставка подарка должна быть приурочена к правильному культурному событию.

**Где ставится в очередь:** `giftController.js` (при подтверждении доставки парой)

**Тип job'а:** `'gift-delivery-confirmation'`

```javascript
// src/controllers/giftController.js (новый метод)
const { emailQueue } = require('../queues/emailQueue');

/**
 * Культурные тайминги казахских свадебных традиций
 */
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

async function confirmGiftDelivery(req, res) {
  const { giftId } = req.params;
  const coupleId = req.user.id;

  // 1. Обновляем статус подарка в БД
  const gift = await prisma.gift.findFirst({
    where: { id: parseInt(giftId), coupleId },
    include: { couple: { include: { user: true } } },
  });

  if (!gift) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Gift not found' });
  }

  // Определяем культурный тайминг на основе даты свадьбы
  const weddingDate = gift.couple.weddingDate;
  const daysUntilWedding = weddingDate
    ? Math.ceil((weddingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  let recommendedTiming = CULTURAL_DELIVERY_TIMING.TOY; // default
  let timingNote = '';

  if (daysUntilWedding !== null) {
    if (daysUntilWedding > 14) {
      recommendedTiming = CULTURAL_DELIVERY_TIMING.QUDA_TUSU;
      timingNote = `До свадьбы ${daysUntilWedding} дней. Рекомендуется вручить при құда түсу.`;
    } else if (daysUntilWedding > 3) {
      recommendedTiming = CULTURAL_DELIVERY_TIMING.BETASHAR;
      timingNote = `До свадьбы ${daysUntilWedding} дней. Рекомендуется на беташар.`;
    } else if (daysUntilWedding >= 0) {
      recommendedTiming = CULTURAL_DELIVERY_TIMING.TOY;
      timingNote = 'В день свадьбы — основной подарок на тое.';
    } else {
      // Свадьба уже прошла
      recommendedTiming = CULTURAL_DELIVERY_TIMING.KUIRYK_BAUYR;
      timingNote = `Свадьба была ${Math.abs(daysUntilWedding)} дней назад. Подарок можно вручить на құйрық-бауыр.`;
    }
  }

  const updatedGift = await prisma.gift.update({
    where: { id: parseInt(giftId) },
    data: {
      status: 'delivered',
      deliveredAt: new Date(),
      deliveryTiming: recommendedTiming.code,
    },
  });

  // 2. Ставим задачу в Redis — подтверждение доставки
  await emailQueue.add('gift-delivery-confirmation', {
    type: 'gift-delivery-confirmation',
    to: gift.couple.user.email,    // паре
    ccGuests: true,                  // флаг — воркер отправит и гостям
    data: {
      giftName: gift.name,
      coupleName: gift.couple.user.fullName,
      deliveredAt: updatedGift.deliveredAt,
      culturalTiming: {
        code: recommendedTiming.code,
        label: recommendedTiming.label,
        labelRu: recommendedTiming.labelRu,
        description: recommendedTiming.description,
        timingNote,
      },
      handlingFlags: gift.handlingFlags || [],
      deliveryNote: buildDeliveryNote(gift.handlingFlags || []),
      packagingRequirements: getPackagingRequirements(gift.handlingFlags || []),
      logisticsManifest: buildLogisticsManifest(gift.handlingFlags || [], {
        name: gift.name,
      }),
    },
    opts: {
      attempts: 3,
      // Приоритет: доставка подтверждения — высокая
      priority: 1,
      delay: 0, // отправить сразу
    },
  });

  // 3. Мгновенный ответ
  return res.json({
    message: 'Gift delivery confirmed',
    gift: {
      id: updatedGift.id,
      name: updatedGift.name,
      status: updatedGift.status,
      deliveredAt: updatedGift.deliveredAt,
      deliveryTiming: recommendedTiming,
      timingNote,
    },
  });
}
```

---

## Воркер (обрабатывает все 3 события асинхронно)

```javascript
// src/workers/emailWorker.js — расширенная версия
const { Worker } = require('bullmq');
const { redisClient } = require('../config/redis');
const { sendMail } = require('../services/emailService');
const { annotateFlags, buildDeliveryNote, buildLogisticsManifest } = require('../services/handlingFlagsService');

const worker = new Worker(
  'emails',
  async (job) => {
    const { type, to, data } = job.data;

    console.log(`📧 [Worker] Processing job ${job.id}: ${type}`);

    switch (type) {
      // ─── Существующие ──────────────────────────────────────────
      case 'verification':
        await sendVerificationEmail(to, data.code);
        break;

      case 'password-reset':
        await sendPasswordResetEmail(to, data.token);
        break;

      case 'contribution-confirmation':
        await sendContributionConfirmationEmail(to, data);
        break;

      case 'gift-funded':
        await sendGiftFundedEmail(to, data);
        break;

      // ─── НОВЫЕ: 3 бизнес-события ──────────────────────────────

      case 'registry-invitation':
        await sendRegistryInvitationEmail(to, data);
        break;

      case 'funding-progress-update':
        await sendFundingProgressUpdateEmail(data);
        break;

      case 'gift-delivery-confirmation':
        await sendGiftDeliveryConfirmationEmail(to, data);
        if (data.ccGuests && data.guestEmails?.length) {
          for (const guestEmail of data.guestEmails) {
            await sendGiftDeliveryConfirmationEmail(guestEmail, {
              ...data,
              isGuestCopy: true,
            });
          }
        }
        break;

      default:
        throw new Error(`Unknown email job type: ${type}`);
    }

    console.log(`✅ [Worker] Job ${job.id} (${type}) completed`);
  },
  {
    connection: redisClient,
    // Обрабатываем до 5 задач одновременно
    concurrency: 5,
    // Если задача упала — повторяем с экспоненциальной задержкой
    settings: {
      backoffStrategy: (attemptsMade) => Math.min(attemptsMade * 5000, 60000),
    },
  }
);

// ─── Новые email-функции ──────────────────────────────────────────────

async function sendRegistryInvitationEmail(email, data) {
  const subject =
    `🎉 ${data.coupleName} приглашает вас в свадебный реестр Saukele!`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d4a574;">Приглашение в реестр</h2>
      <p>Здравствуйте, <strong>${data.guestName}</strong>!</p>
      <p><strong>${data.coupleName}</strong> приглашает вас присоединиться к их свадебному реестру в <strong>Saukele</strong>.</p>
      <p>Ваша роль: <em>${data.kinshipTierLabel}</em></p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.registerUrl}"
           style="background: #d4a574; color: white; padding: 14px 36px; border-radius: 6px;
                  text-decoration: none; font-weight: bold; font-size: 16px;">
          Принять приглашение
        </a>
      </div>
      <p style="color: #888; font-size: 12px;">
        Ссылка действительна до ${data.expiresAt.toLocaleDateString('ru-KZ')}.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">
        Если вы не ожидали этого приглашения — проигнорируйте это письмо.
      </p>
    </div>
  `;

  return sendMail({ to: email, subject, html });
}

async function sendFundingProgressUpdateEmail(data) {
  const subject =
    `📊 Прогресс сбора на «${data.giftName}»: ${data.progressPercent.toFixed(1)}%`;

  const progressBar = generateProgressBar(data.progressPercent);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d4a574;">Обновление прогресса</h2>
      <p><strong>${data.contributorName}</strong> внёс вклад в подарок <strong>${data.giftName}</strong>!</p>

      <div style="background: #f8f0e6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;">
          Собрано: <strong>${data.fundedAmount} ${data.currency}</strong>
          из <strong>${data.targetAmount} ${data.currency}</strong>
        </p>
        ${progressBar}
        <p style="margin: 5px 0 0; text-align: center; font-size: 14px;">
          <strong>${data.progressPercent.toFixed(1)}%</strong>
        </p>
      </div>

      <p style="color: #888; font-size: 12px;">
        Вы получили это письмо, так как участвуете в сборе средств на подарок.
      </p>
    </div>
  `;

  // Рассылаем каждому гостю индивидуально (в цикле воркера)
  const results = [];
  for (const guestEmail of data.guestEmails) {
    try {
      const result = await sendMail({ to: guestEmail, subject, html });
      results.push({ email: guestEmail, sent: true, messageId: result.messageId });
    } catch (err) {
      console.error(`[FundingProgress] Failed to send to ${guestEmail}: ${err.message}`);
      results.push({ email: guestEmail, sent: false, error: err.message });
    }
  }

  return results;
}

function generateProgressBar(percent) {
  const filled = Math.round(percent / 5); // из 20 блоков
  const empty = 20 - filled;
  return `
    <div style="background: #e0ddd7; border-radius: 10px; padding: 2px; margin: 10px 0;">
      <div style="
        background: linear-gradient(90deg, #d4a574, #c49565);
        width: ${Math.min(percent, 100)}%;
        height: 20px;
        border-radius: 8px;
        transition: width 0.5s;
      "></div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #888;">
      <span>0%</span>
      <span>50%</span>
      <span>100%</span>
    </div>
  `;
}

async function sendGiftDeliveryConfirmationEmail(email, data) {
  const isGuest = data.isGuestCopy;
  const subject = isGuest
    ? `🎁 Подарок «${data.giftName}» доставлен!`
    : `✅ Подтверждение доставки подарка «${data.giftName}»`;

  const culturalSection = data.culturalTiming
    ? `
      <div style="background: #f0e6d8; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #d4a574;">
        <h3 style="margin: 0 0 8px; color: #8B4513;">🎎 Культурный тайминг</h3>
        <p style="margin: 4px 0;"><strong>${data.culturalTiming.label}</strong> (${data.culturalTiming.labelRu})</p>
        <p style="margin: 4px 0; color: #666;">${data.culturalTiming.description}</p>
        <p style="margin: 8px 0 0; font-style: italic; color: #8B4513;">
          📌 ${data.culturalTiming.timingNote}
        </p>
      </div>
    `
    : '';

  const handlingSection = data.handlingFlags?.length
    ? `
      <div style="background: #fff8ee; padding: 12px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #c49565;">
        <h4 style="margin: 0 0 8px; color: #666;">📋 Логистическая информация</h4>
        <p style="margin: 4px 0;"><strong>Заметка при доставке:</strong> ${data.deliveryNote || '—'}</p>
        <p style="margin: 4px 0;"><strong>Упаковка:</strong> ${data.packagingRequirements?.packagingReason || 'Стандартная'}</p>
      </div>
    `
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d4a574;">${isGuest ? '🎁 Подарок доставлен!' : '✅ Доставка подтверждена'}</h2>
      <p>${isGuest
        ? `Подарок <strong>«${data.giftName}»</strong> для молодых был успешно доставлен!`
        : `Подарок <strong>«${data.giftName}»</strong> подтверждён как доставленный.`
      }</p>
      <p style="color: #888;">Доставлено: ${new Date(data.deliveredAt).toLocaleString('ru-KZ')}</p>
      ${culturalSection}
      ${handlingSection}
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">
        Спасибо, что пользуетесь <strong>Saukele</strong>! 🎉
      </p>
    </div>
  `;

  return sendMail({ to: email, subject, html });
}

// ─── Логирование ──────────────────────────────────────────────────────

worker.on('completed', (job) => {
  console.log(`✅ [Worker] Job ${job.id} (${job.data.type}) complete`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [Worker] Job ${job?.id} (${job?.data?.type}) failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('❌ [Worker] Error:', err.message);
});

console.log('📧 Email Worker started, waiting for jobs...');
```

---

## Мгновенный ответ API vs асинхронная очередь

| Аспект | Без очереди (синхронно) | С очередью (BullMQ + Redis) |
|--------|------------------------|----------------------------|
| Время ответа API | 500ms–5s (ожидание SMTP) | 5–10ms (только постановка в очередь) |
| Надёжность | Если SMTP упал — запрос падает | Redis хранит задачу, Worker перезапустится |
| Retry | Нужно писать вручную | Встроенный: `attempts: 3`, backoff |
| Debounce | Нет | `deduplication.id` + `ttl` |
| Нагрузка | Блокирует event loop | Worker управляет concurrency |
| Масштабирование | 1 процесс = 1 письмо | N workers = параллельная обработка |

## Как запустить

```bash
# 1. Запустить Redis (через Docker)
docker-compose up -d redis

# 2. Запустить Worker (в отдельном терминале)
npm run worker:email

# 3. Запустить API (в другом терминале)
npm run dev
```

## Проверка очереди

```bash
# Посмотреть размер очереди
redis-cli LLEN bull:emails:wait

# Мониторинг live-событий
redis-cli MONITOR | grep emails
```
