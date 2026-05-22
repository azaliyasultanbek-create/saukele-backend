const { prisma } = require('./src/config/database');

async function main() {
  const users = await prisma.user.findMany({
    where: { email: 'azisultanbek47@gmail.com' }
  });
  
  console.log('Найдено пользователей с email azisultanbek47@gmail.com:', users.length);
  for (const u of users) {
    console.log('  ID:', u.id, 'phone:', u.phone, 'role:', u.role, 'emailVerified:', u.emailVerified);
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
