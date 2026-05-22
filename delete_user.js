const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node delete_user.js <email>');
    console.log('Or:    node delete_user.js --all');
    process.exit(1);
  }

  if (email === '--all') {
    // Delete all related data first
    await prisma.refreshToken.deleteMany();
    await prisma.userToken.deleteMany();
    await prisma.contribution.deleteMany();
    await prisma.gift.deleteMany();
    await prisma.weddingCouple.deleteMany();
    await prisma.familyMember.deleteMany();
    await prisma.user.deleteMany();
    console.log('All users and related data deleted!');
  } else {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`User with email "${email}" not found`);
      process.exit(1);
    }

    console.log(`Deleting user: ${user.fullName} (${user.email})`);

    // Delete in correct order
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.userToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log('User deleted successfully!');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
