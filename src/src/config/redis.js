const Redis = require('ioredis');
const env = require('./env');

class MockRedisClient {
  constructor() {
    this.isOpen = true;
    this.store = new Map();
    console.log('Using MOCK Redis client (for testing)');
  }

  async connect() { return this; }
  async set(key, value) { this.store.set(key, value); return 'OK'; }
  async get(key) { return this.store.get(key) ?? null; }
  async del(key) { this.store.delete(key); return 1; }
  async keys() { return [...this.store.keys()]; }
  async quit() { this.isOpen = false; }
  on() {}
}

// Use mock Redis in development if real Redis is not available
const useMockRedis = process.env.NODE_ENV === 'test' || process.env.USE_MOCK_REDIS === 'true';

let redisClient;
let connectRedis;

if (useMockRedis) {
  console.log('✓ Using MOCK Redis client (for development)');
  redisClient = new MockRedisClient();
  connectRedis = async () => redisClient;
} else {
  const redisUrl = env.redisUrl || 'redis://localhost:6379';
  console.log(`Connecting to Redis at: ${redisUrl}`);
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error(`✗ Redis connection failed after ${times} attempts`);
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    },
  });

  redisClient.on('connect', () => console.log('✓ Redis connected'));
  redisClient.on('error', (err) => {
    // Only log non-EADDRNOTAVAIL errors to avoid noise during retry
    if (err.code !== 'ECONNREFUSED' || process.env.NODE_ENV === 'production') {
      console.error('✗ Redis error:', err.message);
    }
  });

  connectRedis = async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      console.warn(`⚠ Redis not available (${err.message}), using MockRedis instead`);
      // Replace the redisClient reference with MockRedis so BullMQ queue/worker
      // that hold a reference to the redisClient module variable will use mock
      const mockClient = new MockRedisClient();
      module.exports.redisClient = mockClient;
      redisClient = mockClient;
    }
    return redisClient;
  };
}

module.exports = {
  redisClient,
  connectRedis
};