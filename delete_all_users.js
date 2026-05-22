const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  await prisma.refreshToken.deleteMany();
  await prisma.userToken.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.gift.deleteMany();
  await prisma.familyTree.deleteMany();
  await prisma.kinshipRegistry.deleteMany();
  await prisma.coupleProfile.deleteMany();
  await prisma.user.deleteMany();
  
  console.log('All users and related data deleted successfully!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
