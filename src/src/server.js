const app = require('./app');
const env = require('./config/env');
const { prisma } = require('./config/database');
const { connectRedis, redisClient } = require('./config/redis');
const { emailQueue } = require('./queues/emailQueue');

async function startServer() {
  try {
    await prisma.$connect();
    await connectRedis();

    const server = app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
      console.log(`Environment: ${env.nodeEnv}`);
    });

    const gracefulShutdown = async () => {
      console.log('Shutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        if (emailQueue) await emailQueue.close();
        if (redisClient?.quit) await redisClient.quit();
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();