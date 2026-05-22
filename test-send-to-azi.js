const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });


process.env.USE_MOCK_REDIS = 'true';

async function main() {
  const { queueRegistryInvitationEmail } = require('./src/services/registryService');
  
  console.log('Отправляем приглашение для гостя azi (azisultanbek47@gmail.com)...\n');
  
  const result = await queueRegistryInvitationEmail({
    recipientEmail: 'azisultanbek47@gmail.com',
    inviterName: 'dari & partner',
    registryName: 'dari & partner Wedding Registry',
    invitationLink: 'http://localhost:5173/register?invitedBy=10',
  });
  
  console.log('Результат:', JSON.stringify(result, null, 2));
  console.log('\n✅ Проверьте почту azisultanbek47@gmail.com');
}

main().catch(e => console.error('Ошибка:', e));
