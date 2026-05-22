const crypto = require('crypto');

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

const rawToken = 'dbead9b24e441402b2a6694c1c47843be42fafc8e98429735e01033f64283845';
console.log('Token from frontend:', rawToken);
console.log('Its hash:', hashToken(rawToken));

// Теперь давайте посмотрим ALL токены и их хэши
const { prisma } = require('./src/config/database');

async function main() {
  const tokens = await prisma.userToken.findMany({
    where: { userId: 8, type: 'password_reset' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('\n=== Сравнение хэшей ===');
  for (const t of tokens) {
    console.log('Token ID:', t.id);
    console.log('  hash in DB:', t.tokenHash);
    console.log('  computed:', hashToken(rawToken));
    console.log('  MATCH:', t.tokenHash === hashToken(rawToken) ? '✅ YES' : '❌ NO');
    console.log('  usedAt:', t.usedAt);
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
