const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('=== Проверяем, что загружается ===\n');


const familyCtrl = require('./src/controllers/familyController');
const srcStr = familyCtrl.addFamilyMember.toString();
const hasEmailCode = srcStr.includes('queueRegistryInvitationEmail') || srcStr.includes('recipientEmail');
console.log('1. addFamilyMember в src/controllers/familyController.js');
console.log('   Содержит код отправки email?', hasEmailCode ? '✅ ДА' : '❌ НЕТ');


const emailSvc = require('./src/services/emailService');
console.log('\n2. sendRegistryInvitationEmail в src/services/emailService.js');
console.log('   Тема письма:', emailSvc.sendRegistryInvitationEmail.toString().includes('приглашает') ? '✅ НА РУССКОМ' : '⚠️ СТАРАЯ ВЕРСИЯ');


const { emailQueue } = require('./src/queues/emailQueue');
console.log('\n3. emailQueue тип:', emailQueue.constructor.name);
console.log('   registry-invitation обрабатывается:', 
  emailQueue.add.toString().includes('registry-invitation') ? '✅ ДА' : '⚠️ НЕТ');


const regSvc = require('./src/services/registryService');
console.log('\n4. registryService экспортирует queueRegistryInvitationEmail:', 
  typeof regSvc.queueRegistryInvitationEmail === 'function' ? '✅ ДА' : '❌ НЕТ');

console.log('\n=== ВСЁ ПРОВЕРЕНО ===');
