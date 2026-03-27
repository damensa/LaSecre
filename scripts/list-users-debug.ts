import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function listUsers() {
  const users = await prisma.user.findMany({
    select: { phone: true, createdAt: true, status: true }
  });
  console.log('--- User List ---');
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

listUsers();
