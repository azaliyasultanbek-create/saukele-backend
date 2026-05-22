require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
 
  const gifts = await prisma.gift.findMany({
    where: { coupleId: 11 }
  });
  console.log('Подарки coupleId=11:');
  for (const g of gifts) {
    console.log('  id=' + g.id + ' | ' + g.name + ' | ' + g.fundedAmount + '/' + g.targetAmount + ' ' + g.currency + ' | status=' + g.status);
  }

 
  const contribs = await prisma.contribution.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: {
      guest: { select: { id: true, fullName: true, email: true } },
      gift: { select: { id: true, name: true } }
    }
  });
  console.log('\nПоследние 10 взносов:');
  for (const c of contribs) {
    console.log('  ' + c.timestamp + ' | ' + c.guest.fullName + ' (' + c.guest.email + ') | ' + c.gift.name + ' | ' + c.originalAmount + ' ' + c.currencyUsed + ' | status=' + c.status);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
