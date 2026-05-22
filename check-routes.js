const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('=== Проверяем, что загружается ===\n');

// Проверим familyController
const familyCtrl = require('./src/controllers/familyController');
const srcStr = familyCtrl.addFamilyMember.toString();
const hasEmailCode = srcStr.includes('queueRegistryInvitationEmail') || srcStr.includes('recipientEmail');
console.log('1. addFamilyMember в src/controllers/familyController.js');
console.log('   Содержит код отправки email?', hasEmailCode ? '✅ ДА' : '❌ НЕТ');

// Проверим emailService
const emailSvc = require('./src/services/emailService');
console.log('\n2. sendRegistryInvitationEmail в src/services/emailService.js');
console.log('   Тема письма:', emailSvc.sendRegistryInvitationEmail.toString().includes('приглашает') ? '✅ НА РУССКОМ' : '⚠️ СТАРАЯ ВЕРСИЯ');

// Проверим emailQueue
const { emailQueue } = require('./src/queues/emailQueue');
console.log('\n3. emailQueue тип:', emailQueue.constructor.name);
console.log('   registry-invitation обрабатывается:', 
  emailQueue.add.toString().includes('registry-invitation') ? '✅ ДА' : '⚠️ НЕТ');

// Проверим registryService
const regSvc = require('./src/services/registryService');
console.log('\n4. registryService экспортирует queueRegistryInvitationEmail:', 
  typeof regSvc.queueRegistryInvitationEmail === 'function' ? '✅ ДА' : '❌ НЕТ');

console.log('\n=== ВСЁ ПРОВЕРЕНО ===');
