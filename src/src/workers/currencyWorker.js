const { Queue, Worker } = require('bullmq');
const { redisClient } = require('../config/redis');
const { refreshRates } = require('../services/currencyService');

const useMockRedis = process.env.USE_MOCK_REDIS === 'true';

if (useMockRedis) {
  console.log('[CurrencyWorker] Using MockRedis — currency scheduler disabled');
  module.exports = {};
} else {
const queue = new Queue('currency', { connection: redisClient });

(async () => {
  await queue.upsertJobScheduler(
    'refresh-rates-every-30-min',
    { every: 30 * 60 * 1000 },
    {
      name: 'refresh-rates',
      data: {}
    }
  );
})();

new Worker('currency', async () => {
  await refreshRates();
}, { connection: redisClient });

  module.exports = { queue };
}
