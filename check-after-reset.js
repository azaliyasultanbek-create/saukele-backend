const { prisma } = require('./src/config/database');

async function main() {
  const tokens = await prisma.userToken.findMany({
    where: { userId: 8, type: 'password_reset' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('=== TOKENS ===');
  for (const t of tokens) {
    console.log('ID:', t.id, 
      'usedAt:', t.usedAt, 
      'expiresAt:', t.expiresAt,
      'hash first 20:', t.tokenHash.substring(0, 20) + '...');
  }

  const user = await prisma.user.findUnique({
    where: { id: 8 },
    select: { passwordHash: true, emailVerified: true }
  });
  
  console.log('\n=== USER ===');
  console.log('passwordHash (first 20):', user.passwordHash.substring(0, 20) + '...');
  console.log('emailVerified:', user.emailVerified);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
