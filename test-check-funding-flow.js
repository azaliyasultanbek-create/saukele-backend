
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  

 
  const gifts = await prisma.gift.findMany({
    where: { fundedAmount: { gt: 0 } },
    include: { couple: true }
  });

  if (gifts.length === 0) {
    console.log('❌ Нет подарков с взносами. Сначала сделайте взнос.');
    await prisma.$disconnect();
    return;
  }

  for (const gift of gifts) {
    console.log(`\n─── Подарок: "${gift.name}" (id=${gift.id}) ───`);
    console.log(`   coupleId: ${gift.coupleId}`);
    console.log(`   fundedAmount: ${gift.fundedAmount} ${gift.currency}`);
    console.log(`   targetAmount: ${gift.targetAmount} ${gift.currency}`);
    console.log(`   progress: ${((gift.fundedAmount / gift.targetAmount) * 100).toFixed(1)}%`);


    const familyEntries = await prisma.familyTree.findMany({
      where: { coupleId: gift.coupleId },
      include: {
        guest: { select: { id: true, fullName: true, email: true } }
      }
    });

    console.log(`\n   👥 Гости в family_tree (${familyEntries.length}):`);
    if (familyEntries.length === 0) {
      console.log('   ❌ НЕТ ГОСТЕЙ! Уведомление некому отправлять.');
    } else {
      for (const fe of familyEntries) {
        const hasEmail = fe.guest.email ? '✅' : '❌';
        console.log(`   ${hasEmail} id=${fe.guest.id} | ${fe.guest.fullName || '—'} | email: ${fe.guest.email || 'НЕТ EMAIL!'} | tier: ${fe.kinshipTier}`);
      }

      const withEmail = familyEntries.filter(fe => fe.guest.email);
      console.log(`\n   📧 Гостей С email: ${withEmail.length} из ${familyEntries.length}`);
      
      if (withEmail.length === 0) {
        console.log('   ❌ НЕТ ГОСТЕЙ С EMAIL! Уведомление не уйдёт.');
        console.log('   💡 Решение: добавьте email гостям в БД или при регистрации.');
      } else {
        console.log('   ✅ Есть кому отправлять!');
      }
    }

    
    const contributions = await prisma.contribution.findMany({
      where: { giftId: gift.id },
      include: { guest: { select: { id: true, fullName: true, email: true } } },
      orderBy: { timestamp: 'desc' }
    });

    console.log(`\n   💰 Взносы (${contributions.length}):`);
    for (const c of contributions) {
      console.log(`   • ${c.guest.fullName || '—'} (id=${c.guest.id}) | ${c.originalAmount} ${c.currencyUsed} → ${c.amount} ${gift.currency} | ${c.timestamp}`);
    }

    if (contributions.length > 0) {
      const lastContributor = contributions[0];
      console.log(`\n   📝 Последний взнос от: ${lastContributor.guest.fullName || '—'} (id=${lastContributor.guest.id})`);
      console.log(`   📝 Его email: ${lastContributor.guest.email || 'НЕТ'}`);
      
      // Другие гости (кроме последнего плательщика)
      const otherGuests = withEmail.filter(fe => fe.guest.id !== lastContributor.guest.id);
      console.log(`   📧 Других гостей для уведомления: ${otherGuests.length}`);
      if (otherGuests.length === 0) {
        console.log('   ❌ Все остальные гости без email или их нет!');
      }
    }
  }

  await prisma.$disconnect();
  
}

check().catch(console.error);
