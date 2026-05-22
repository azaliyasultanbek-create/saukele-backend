/**
 * Сервис для защиты имммутабельных (неизменяемых) полей.
 *
 * Концепция:
 * - Финансовые строки (Contribution) после создания становятся ИММУТАБЕЛЬНЫМИ.
 * - Поля 'locked_at_timestamp' и 'locked_exchange_rate' (а также 'amount',
 *   'exchangeRateUsed', 'currencyUsed', 'originalAmount')
 *   ЗАПРЕЩЕНО обновлять после записи в БД.
 * - Этот сервис проверяет входящие данные на попытку изменения защищённых полей
 *   и выбрасывает ошибку, если обнаруживает нарушение.
 *
 * Стратегия защиты (2 уровня):
 *   Уровень 1 — Middleware/service guard (здесь): проверка на уровне приложения.
 *   Уровень 2 — DB trigger (рекомендуется для production): дополнительная
 *               защита на уровне PostgreSQL.
 */

// ─── Список иммутабельных полей модели Contribution ──────────────────────
// После того как взнос создан (особенно со статусом 'completed'),
// эти поля НЕ ДОЛЖНЫ меняться.
const IMMUTABLE_FIELDS = [
  'giftId',
  'guestId',
  'amount',
  'exchangeRateUsed',
  'currencyUsed',
  'originalAmount',
  'lockedAt',
  'lockedRate',
  'locked_at_timestamp',
  'locked_exchange_rate',
];

// ─── Поля, которые разрешено обновлять (в определённых статусах) ─────────
// status, escrowApprovedAt, escrowApprovedBy, kaspiPaymentId, isAnonymous
const MUTABLE_FIELDS = [
  'status',
  'escrowApprovedAt',
  'escrowApprovedBy',
  'kaspiPaymentId',
  'isAnonymous',
];

/**
 * Проверить, содержит ли объект data попытку изменить иммутабельные поля.
 *
 * @param {number} contributionId - ID взноса (для сообщения об ошибке)
 * @param {object} data - входящие данные для обновления
 * @throws {Error} IMMUTABLE_FIELD_VIOLATION — если обнаружена попытка изменить защищённое поле
 */
function guardImmutableFields(contributionId, data) {
  if (!data || typeof data !== 'object') return;

  const violations = [];

  for (const key of Object.keys(data)) {
    // Проверяем и camelCase, и snake_case варианты
    const normalizedKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
                             .replace(/^([A-Z])/, (c) => c.toLowerCase());

    const isFieldImmutable = IMMUTABLE_FIELDS.some(
      (f) => f === key || f === normalizedKey
    );

    if (isFieldImmutable) {
      violations.push(key);
    }
  }

  if (violations.length > 0) {
    const error = new Error(
      `IMMUTABLE_FIELD_VIOLATION: Attempt to update immutable field(s) ` +
      `[${violations.join(', ')}] on contribution #${contributionId}. ` +
      `Financial audit fields cannot be modified after creation.`
    );
    error.code = 'IMMUTABLE_FIELD_VIOLATION';
    error.contributionId = contributionId;
    error.violations = violations;
    throw error;
  }
}

/**
 * Проверить, что для Contribution установлены оба блокирующих поля
 * (lockedAt и lockedRate) — это гарантирует, что snapshot курса был зафиксирован.
 *
 * @param {object} contribution - объект Contribution из БД
 * @throws {Error} MISSING_LOCKED_FIELDS — если поля не установлены
 */
function assertContributionIsLocked(contribution) {
  if (!contribution) {
    throw new Error('CONTRIBUTION_NOT_FOUND');
  }

  const hasAt = contribution.lockedAt !== null && contribution.lockedAt !== undefined;
  const hasRate = contribution.lockedRate !== null && contribution.lockedRate !== undefined;

  if (!hasAt || !hasRate) {
    const error = new Error(
      `MISSING_LOCKED_FIELDS: Contribution #${contribution.id} is missing ` +
      `locked_at_timestamp and/or locked_exchange_rate. ` +
      `This indicates a data integrity issue — the exchange rate snapshot was not recorded.`
    );
    error.code = 'MISSING_LOCKED_FIELDS';
    error.contributionId = contribution.id;
    throw error;
  }
}

module.exports = {
  IMMUTABLE_FIELDS,
  MUTABLE_FIELDS,
  guardImmutableFields,
  assertContributionIsLocked,
};
