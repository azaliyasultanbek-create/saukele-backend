require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  
  const contribs = await prisma.contribution.findMany({
    where: {
      guestId: { in: [8, 13] }
    },
    orderBy: { timestamp: 'desc' },
    include: {
      guest: { select: { id: true, fullName: true, email: true } },
      gift: { select: { id: true, name: true, coupleId: true, fundedAmount: true, targetAmount: true } }
    }
  });

  console.log('Все взносы azi (id=8) и DARI (id=13):');
  for (const c of contribs) {
    console.log('  [' + c.guest.fullName + '] ' + c.timestamp.toLocaleString() + ' | gift: ' + c.gift.name + ' (coupleId=' + c.gift.coupleId + ') | ' + c.originalAmount + ' ' + c.currencyUsed + ' | cтатус=' + c.status);
  }

  if (contribs.length === 0) {
    console.log('  Нет взносов');
  }

 
  const gifts = await prisma.gift.findMany({
    where: { coupleId: 11 }
  });
  console.log('\nВсе подарки пары 11 (где azi и DARI в family_tree):');
  for (const g of gifts) {
    console.log('  id=' + g.id + ' | name="' + g.name + '" | funded=' + g.fundedAmount + '/' + g.targetAmount + ' | status=' + g.status);
  }

  
  const gifts10 = await prisma.gift.findMany({
    where: { coupleId: 10 }
  });
  console.log('\nВсе подарки пары 10 (где azi в family_tree):');
  for (const g of gifts10) {
    console.log('  id=' + g.id + ' | name="' + g.name + '" | funded=' + g.fundedAmount + '/' + g.targetAmount + ' | status=' + g.status);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
