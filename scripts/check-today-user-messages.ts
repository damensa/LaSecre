import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const messages = await prisma.message.findMany({
    where: { 
      role: 'user',
      createdAt: { gte: today }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('--- User Messages Today ---');
  console.log(JSON.stringify(messages, null, 2));
  await prisma.$disconnect();
}

check();
