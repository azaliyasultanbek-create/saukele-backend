const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.databaseUrl
    }
  },
  log: env.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error']
});

async function disconnectPrisma() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  disconnectPrisma
};