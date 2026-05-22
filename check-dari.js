require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const last = await prisma.contribution.findFirst({
    where: {
      guest: { email: 'azaliya.sultanbek@narxoz.kz' }
    },
    orderBy: { timestamp: 'desc' },
    include: {
      guest: { select: { id: true, fullName: true, email: true } },
      gift: { select: { id: true, name: true, coupleId: true, fundedAmount: true, targetAmount: true, currency: true } }
    }
  });

  if (!last) {
    console.log('Нет взносов от dari');
    await prisma.$disconnect();
    return;
  }

  console.log('Последний взнос dari:');
  console.log('  Подарок:', last.gift.name, '(id=' + last.gift.id + ')');
  console.log('  coupleId:', last.gift.coupleId);
  console.log('  Сумма:', last.originalAmount, last.currencyUsed);
  const pct = (last.gift.fundedAmount / last.gift.targetAmount) * 100;
  console.log('  Прогресс:', pct.toFixed(1) + '%');
  console.log('  dari id:', last.guest.id);

  const family = await prisma.familyTree.findMany({
    where: { coupleId: last.gift.coupleId },
    include: { guest: { select: { id: true, fullName: true, email: true } } }
  });

  console.log('\nГости в family_tree (coupleId=' + last.gift.coupleId + '):');
  for (const fe of family) {
    const isMe = fe.guest.id === last.guest.id ? ' ← DARI (КТО ВНЁС)' : '';
    const hasEmail = fe.guest.email ? '✅' : '❌';
    console.log('  ' + hasEmail + ' id=' + fe.guest.id + ' | ' + (fe.guest.fullName || '—') + ' | ' + (fe.guest.email || 'НЕТ EMAIL') + isMe);
  }


  const others = family.filter(fe => fe.guest.email && fe.guest.id !== last.guest.id);
  console.log('\nДругих гостей для уведомления:', others.length);
  if (others.length === 0) {
    console.log('❌ Некому отправлять — других гостей с email нет');
  } else {
    console.log('✅ Будут уведомлены:');
    others.forEach(fe => console.log('  ➡ ' + fe.guest.email));
  }

 
  const samsung = await prisma.gift.findFirst({ where: { name: 'samsung' } });
  if (samsung) {
    console.log('\nПодарок "samsung": id=' + samsung.id + ', coupleId=' + samsung.coupleId);
    console.log('  fundedAmount:', samsung.fundedAmount, 'targetAmount:', samsung.targetAmount);
    const samsungFamily = await prisma.familyTree.findMany({
      where: { coupleId: samsung.coupleId },
      include: { guest: { select: { id: true, fullName: true, email: true } } }
    });
    console.log('Гости в family_tree для samsung (coupleId=' + samsung.coupleId + '):');
    for (const fe of samsungFamily) {
      const hasEmail = fe.guest.email ? '✅' : '❌';
      console.log('  ' + hasEmail + ' id=' + fe.guest.id + ' | ' + (fe.guest.fullName || '—') + ' | ' + (fe.guest.email || 'НЕТ EMAIL'));
    }
  }

  await prisma.$disconnect();
}

check().catch(console.error);
