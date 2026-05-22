const { prisma } = require('./src/config/database');

async function main() {
 
  const token = await prisma.userToken.findFirst({
    where: { userId: 8, type: 'password_reset' },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!token) {
    console.log('Нет токенов для сброса пароля');
    process.exit(1);
  }
  
  console.log('Последний созданный токен:');
  console.log('  ID:', token.id);
  console.log('  hash в БД:', token.tokenHash);
  console.log('  length:', token.tokenHash.length);
  console.log('  expiresAt:', token.expiresAt);
  console.log('  usedAt:', token.usedAt);
  console.log('');
  console.log('❓ ВОПРОС: Какой rawToken был передан в createPasswordResetToken?');
  console.log('Мы не знаем, так как токен хэшируется. Но мы знаем, что в письме');
  console.log('отправляется rawToken, а в resetPasswordByToken мы хэшируем rawToken');
  console.log('из запроса и сравниваем с tokenHash в БД.');
  console.log('');
  console.log('Возможно, проблема в том, что письмо приходит с другим токеном,');
  console.log('отличным от того, что создал createPasswordResetToken.');
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
