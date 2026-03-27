import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const userPhone = "34640291370";
  const lastMessages = await prisma.message.findMany({
    where: { userPhone },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(`\n--- Last 20 Messages for ${userPhone} ---`);
  lastMessages.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] ${m.role}: ${m.content}`);
  });
  
  await prisma.$disconnect();
}

check();
