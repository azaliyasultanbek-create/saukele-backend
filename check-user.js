
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const phone = process.argv[2] || '77071234567';
  
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    console.log(`❌ Пользователь с телефоном ${phone} НЕ НАЙДЕН`);
    process.exit(1);
  }

  console.log(`✅ Пользователь найден:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Телефон: ${user.phone}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   EmailVerified: ${user.emailVerified}`);
  console.log(`   Роль: ${user.role}`);
  console.log(`   passwordHash (первые 40 символов): ${user.passwordHash.substring(0, 40)}...`);

 
  const testPassword = process.argv[3];
  if (testPassword) {
    const match = await bcrypt.compare(testPassword, user.passwordHash);
    console.log(`\n🔑 Проверка пароля '${testPassword}': ${match ? '✅ СОВПАДАЕТ' : '❌ НЕ СОВПАДАЕТ'}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
