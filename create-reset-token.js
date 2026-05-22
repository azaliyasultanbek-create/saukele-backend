const { prisma } = require('./src/config/database');
const crypto = require('crypto');

function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function main() {
  const email = 'azisultanbek47@gmail.com';
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found with email:', email);
    process.exit(1);
  }
  
 
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  
  await prisma.userToken.create({
    data: {
      userId: user.id,
      tokenHash,
      type: 'password_reset',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  
  console.log('✅ Токен создан!');
  console.log('\n📋 Ссылка для сброса пароля (откройте в браузере):');
  console.log(`http://localhost:5173/reset-password?token=${rawToken}`);
  console.log('\n⚠️  Токен действителен 1 час');
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
