const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function createAdmin() {
  const phone = process.argv[2] || '77000000001';
  const password = process.argv[3] || 'AdminPass123';
  const email = process.argv[4] || 'admin@saukele.kz';
  const fullName = process.argv[5] || 'Admin User';

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { phone },
    update: { role: 'admin', isVerified: true, emailVerified: true },
    create: {
      phone,
      email,
      passwordHash: hashedPassword,
      fullName,
      role: 'admin',
      isVerified: true,
      emailVerified: true,
    }
  });

  console.log('✅ Admin user created/updated:', {
    id: user.id,
    phone: user.phone,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isVerified: user.isVerified,
    emailVerified: user.emailVerified,
  });

  await prisma.$disconnect();
}

createAdmin()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
