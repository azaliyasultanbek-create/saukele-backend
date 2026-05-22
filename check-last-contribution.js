require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recent = await prisma.contribution.findMany({
    where: { timestamp: { gte: fiveMinAgo } },
    include: {
      guest: { select: { id: true, fullName: true, email: true } },
      gift: { select: { id: true, name: true, coupleId: true, fundedAmount: true, targetAmount: true } }
    },
    orderBy: { timestamp: 'desc' }
  });

  if (recent.length === 0) {
    console.log('Нет взносов за последние 5 минут');
    
    const all = await prisma.contribution.findMany({
      take: 3,
      orderBy: { timestamp: 'desc' },
      include: {
        guest: { select: { id: true, fullName: true, email: true } },
        gift: { select: { id: true, name: true, coupleId: true, fundedAmount: true, targetAmount: true } }
      }
    });
    console.log('\nПоследние 3 взноса всего:');
    for (const c of all) {
      console.log(`  ${c.timestamp} | ${c.guest.fullName} (id=${c.guest.id}) | ${c.gift.name} | ${c.originalAmount} ${c.currencyUsed}`);
    }
  }

  for (const c of recent) {
    console.log('\n═══════════════════════════════════════');
    console.log('  СВЕЖИЙ ВЗНОС');
    console.log('═══════════════════════════════════════');
    console.log('Гость:', c.guest.fullName || '—', '(id=' + c.guest.id + ')');
    console.log('Email гостя:', c.guest.email || 'НЕТ');
    console.log('Подарок:', c.gift.name, '(id=' + c.gift.id + ')');
    console.log('Сумма:', c.originalAmount, c.currencyUsed);
    console.log('Прогресс:', ((c.gift.fundedAmount / c.gift.targetAmount) * 100).toFixed(1) + '%');

    const familyEntries = await prisma.familyTree.findMany({
      where: { coupleId: c.gift.coupleId },
      include: { guest: { select: { id: true, fullName: true, email: true } } }
    });

    console.log('\nГости в family_tree этой пары (coupleId=' + c.gift.coupleId + '):');
    for (const fe of familyEntries) {
      const isContributor = fe.guest.id === c.guest.id ? ' ← СДЕЛАЛ ВЗНОС' : '';
      const hasEmail = fe.guest.email ? '✅' : '❌';
      console.log('  ' + hasEmail + ' id=' + fe.guest.id + ' | ' + (fe.guest.fullName || '—') + ' | email: ' + (fe.guest.email || 'НЕТ') + isContributor);
    }

    const otherWithEmail = familyEntries.filter(fe => fe.guest.email && fe.guest.id !== c.guest.id);
    if (otherWithEmail.length > 0) {
      console.log('\n✅ ДОЛЖНЫ БЫЛИ ПОЛУЧИТЬ УВЕДОМЛЕНИЕ:');
      otherWithEmail.forEach(fe => console.log('  ➡ ' + fe.guest.email));
    } else {
      console.log('\n❌ НЕКОМУ ОТПРАВЛЯТЬ');
      if (familyEntries.length <= 1) {
        console.log('  В family_tree только 1 гость');
      } else {
        console.log('  У остальных гостей нет email');
      }
    }
  }

  await prisma.$disconnect();
}

check().catch(console.error);
