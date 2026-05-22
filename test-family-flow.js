const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { queueRegistryInvitationEmail } = require('./src/services/registryService');

async function simulate() {
  const guestPhone = '77711330044';
  const coupleId = 10; // dari
  
  try {
  
    const guest = await prisma.user.findUnique({ where: { phone: guestPhone } });
    console.log('1. Гость найден:', guest ? guest.fullName : 'НЕТ');
    if (!guest) { console.log('СТОП: гость не найден'); return; }
    
    
    const coupleProfile = await prisma.coupleProfile.findUnique({
      where: { coupleId },
      include: { user: { select: { fullName: true } } }
    });
    console.log('2. Профиль пары:', coupleProfile ? coupleProfile.user.fullName + ' & ' + coupleProfile.partner2Name : 'НЕТ');
    
    if (!coupleProfile) { console.log('СТОП: профиль пары не найден'); return; }
    
    
    const coupleDisplayName = coupleProfile 
      ? coupleProfile.user.fullName + ' & ' + (coupleProfile.partner2Name || '')
      : 'Test Couple';
    console.log('3. displayName:', coupleDisplayName);
    
   
    console.log('4. Email гостя:', guest.email || 'ОТСУТСТВУЕТ');
    if (!guest.email) { console.log('СТОП: у гостя нет email'); return; }
    
    
    console.log('5. Отправляю...');
    const result = await queueRegistryInvitationEmail({
      recipientEmail: guest.email,
      inviterName: coupleDisplayName,
      registryName: coupleDisplayName + ' Wedding Registry',
      invitationLink: 'http://localhost:5173/register?invitedBy=' + coupleId,
    });
    console.log('6. Результат:', JSON.stringify(result));
    
  } catch(e) {
    console.error('ОШИБКА:', e.message);
    console.error(e.stack);
  } finally {
    await prisma.$disconnect();
  }
}
simulate();
