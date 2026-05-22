require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const contribs = await prisma.contribution.findMany({
    where: { timestamp: { gte: tenMinAgo } },
    orderBy: { timestamp: 'desc' },
    include: {
      guest: { select: { id: true, fullName: true, email: true } },
      gift: { select: { id: true, name: true, coupleId: true, fundedAmount: true, targetAmount: true } }
    }
  });

  console.log('Свежие взносы (< 10 мин): ' + contribs.length);
  for (const c of contribs) {
    console.log('  ' + c.timestamp.toLocaleString() + ' | ' + (c.guest.fullName || '?') + ' (' + (c.guest.email || 'нет email') + ') | ' + c.gift.name + ' | ' + c.originalAmount + ' ' + c.currencyUsed + ' | статус=' + c.status);
  }

  
  for (const coupleId of [10, 11]) {
    const family = await prisma.familyTree.findMany({
      where: { coupleId },
      include: { guest: { select: { id: true, fullName: true, email: true } } }
    });
    console.log('\nFamilyTree coupleId=' + coupleId + ':');
    for (const f of family) {
      console.log('  id=' + f.guest.id + ' | ' + (f.guest.fullName || '—') + ' | ' + (f.guest.email || 'НЕТ EMAIL') + ' | tier=' + f.kinshipTier);
    }
  }

  await prisma.$disconnect();
}

check().catch(console.error);
