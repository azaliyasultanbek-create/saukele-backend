const { prisma } = require('./src/config/database');

async function main() {
  const user = await prisma.user.findUnique({ where: { phone: '77711330044' } });
  if (!user) { console.log('User not found'); return; }
  
  console.log('User ID:', user.id);
  console.log('Email:', user.email);
  console.log('EmailVerified:', user.emailVerified);
  
  const tokens = await prisma.userToken.findMany({
    where: { userId: user.id, type: 'password_reset', usedAt: null }
  });
  console.log('Active reset tokens:', tokens.length);
  tokens.forEach((t, i) => {
    console.log(`  Token ${i}: expiresAt=${t.expiresAt}, hash=${t.tokenHash.substring(0, 20)}...`);
  });
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
