
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


const MUTABLE_FIELDS = [
  'status',
  'escrowApprovedAt',
  'escrowApprovedBy',
  'kaspiPaymentId',
  'isAnonymous',
];

/**
 
 * @param {number} contributionId 
 * @param {object} data 
 * @throws {Error} IMMUTABLE_FIELD_VIOLATION 
 */
function guardImmutableFields(contributionId, data) {
  if (!data || typeof data !== 'object') return;

  const violations = [];

  for (const key of Object.keys(data)) {
   
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
 
 * @param {object} contribution 
 * @throws {Error} MISSING_LOCKED_FIELDS 
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
