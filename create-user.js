const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createUser() {
  const hashedPassword = await bcrypt.hash('SecurePass123', 10);
  
  const user = await prisma.user.create({
    data: {
      phone: '77071234567',
      passwordHash: hashedPassword,
      fullName: 'Test User',
      role: 'guest'
    }
  });
  
  console.log('User created:', user);
}

createUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());