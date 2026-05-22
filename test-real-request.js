const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { prisma } = require('./src/config/database');
const { queueRegistryInvitationEmail } = require('./src/services/registryService');

async function main() {
  console.log('=== IMITACIYA POST /family/members ===\n');
  
  const guestPhone = '77711330044';
  const coupleId = 10;
  
  try {
    const guest = await prisma.user.findUnique({ where: { phone: guestPhone } });
    console.log('1. Guest:', guest?.fullName, 'Email:', guest?.email);
    if (!guest) { console.log('Not found'); return; }
    
    const coupleProfile = await prisma.coupleProfile.findUnique({
      where: { coupleId },
      include: { user: { select: { fullName: true } } }
    });
    
    const coupleDisplayName = coupleProfile
      ? coupleProfile.user.fullName + ' & ' + (coupleProfile.partner2Name || '')
      : 'Test Couple';
    console.log('2. Couple:', coupleDisplayName);
    
    if (guest.email) {
      console.log('3. Sending to', guest.email);
      const result = await queueRegistryInvitationEmail({
        recipientEmail: guest.email,
        inviterName: coupleDisplayName,
        registryName: coupleDisplayName + ' Wedding Registry',
        invitationLink: 'http://localhost:5173/register?invitedBy=' + coupleId,
      });
      console.log('4. Result:', JSON.stringify(result));
      console.log('\nCheck email:', guest.email);
    } else {
      console.log('3. No email - skip');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();

