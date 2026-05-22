const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ 
    select: { id: true, phone: true, email: true, fullName: true, role: true } 
  });
  
  console.log('=== Пользователи в базе ===');
  if (users.length === 0) {
    console.log('В базе нет пользователей');
  } else {
    users.forEach(u => {
      const hasEmail = u.email ? u.email : '❌ НЕТ EMAIL';
      console.log(`  ID:${u.id} | ${u.fullName} | тел:${u.phone} | email:${hasEmail} | роль:${u.role}`);
    });
  }
  
  console.log('\n=== Проверка FamilyTree ===');
  const family = await prisma.familyTree.findMany({
    include: {
      guest: { select: { fullName: true, email: true, phone: true } },
      couple: { 
        include: { user: { select: { fullName: true } } }
      }
    }
  });
  
  if (family.length === 0) {
    console.log('В базе нет записей родства');
  } else {
    family.forEach(f => {
      console.log(`  Пара: ${f.couple.user.fullName} | Гость: ${f.guest.fullName} (тел:${f.guest.phone}, email:${f.guest.email || '❌'}) | уровень:${f.kinshipTier}`);
    });
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
