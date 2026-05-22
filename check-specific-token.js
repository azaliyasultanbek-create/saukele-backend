const crypto = require('crypto');

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

const tokenFromEmail = 'b53b222d4941a12bae6b7d990d57c0cea71fa54c2f52ebd23757229f61735bef';
const hashFromEmail = hashToken(tokenFromEmail);

console.log('Token из письма:', tokenFromEmail);
console.log('Hash от токена:', hashFromEmail);

const { prisma } = require('./src/config/database');

async function main() {
 
  const tokenInDB = await prisma.userToken.findUnique({
    where: { tokenHash: hashFromEmail }
  });
  
  if (tokenInDB) {
    console.log('\n✅ Токен НАЙДЕН в БД!');
    console.log('  ID:', tokenInDB.id);
    console.log('  userId:', tokenInDB.userId);
    console.log('  type:', tokenInDB.type);
    console.log('  usedAt:', tokenInDB.usedAt);
    console.log('  expiresAt:', tokenInDB.expiresAt);
  } else {
    console.log('\n❌ Токен НЕ НАЙДЕН в БД!');
    console.log('Хэш:', hashFromEmail);
    
   
    const allTokens = await prisma.userToken.findMany({
      where: { userId: 8, type: 'password_reset' },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log('\nВсе токены password_reset для пользователя:');
    for (const t of allTokens) {
      console.log('  ID:', t.id, 'hash:', t.tokenHash, 'usedAt:', t.usedAt);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
