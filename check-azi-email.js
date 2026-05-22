const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { queueRegistryInvitationEmail } = require('./src/services/registryService');

async function main() {
  console.log('=== 1. Проверяем пользователя azi (ID:8) ===');
  const guest = await prisma.user.findUnique({
    where: { id: 8 },
    select: { id: true, fullName: true, email: true, phone: true }
  });
  console.log('  Гость:', JSON.stringify(guest, null, 2));
  
  if (!guest || !guest.email) {
    console.log('❌ У гостя нет email — письмо не отправится!');
    await prisma.$disconnect();
    return;
  }
  
  console.log('\n=== 2. Проверяем семейные записи ===');
  const families = await prisma.familyTree.findMany({
    where: { guestId: 8 },
    include: { 
      couple: { 
        include: { user: { select: { id: true, fullName: true, email: true } } }
      } 
    }
  });
  
  for (const f of families) {
    const coupleProfile = await prisma.coupleProfile.findUnique({
      where: { coupleId: f.coupleId }
    });
    console.log('  Семья:');
    console.log('    coupleId:', f.coupleId);
    console.log('    coupleName:', f.couple.user.fullName);
    console.log('    partner2Name:', coupleProfile?.partner2Name || 'нет');
    console.log('    coupleEmail:', f.couple.user.email);
    console.log('    kinshipTier:', f.kinshipTier);
    
    const coupleDisplayName = coupleProfile 
      ? `${f.couple.user.fullName} & ${coupleProfile.partner2Name || ''}`
      : f.couple.user.fullName;
      
    console.log('    displayName:', coupleDisplayName);
  }
  
  console.log('\n=== 3. Симулируем отправку письма ===');
  const coupleProfile = await prisma.coupleProfile.findUnique({
    where: { coupleId: families[0].coupleId },
    include: { user: { select: { fullName: true } } }
  });
  
  const coupleDisplayName = coupleProfile 
    ? `${coupleProfile.user.fullName} & ${coupleProfile.partner2Name || ''}`
    : 'Test Couple';
  
  console.log('  Отправляем приглашение...');
  const result = await queueRegistryInvitationEmail({
    recipientEmail: guest.email,
    inviterName: coupleDisplayName,
    registryName: `${coupleDisplayName} Wedding Registry`,
    invitationLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?invitedBy=${families[0].coupleId}`,
  });
  console.log('  Результат:', JSON.stringify(result, null, 2));
  
  await prisma.$disconnect();
  console.log('\n✅ Готово! Проверьте почту:', guest.email);
}

main().catch(e => { console.error('Ошибка:', e); process.exit(1); });
