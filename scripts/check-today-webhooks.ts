import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const events = await (prisma as any).webhookEvent.findMany({
    where: { timestamp: { gte: today } },
    orderBy: { timestamp: 'desc' }
  });
  console.log('--- Webhook Events Today ---');
  console.log(JSON.stringify(events, null, 2));
  await prisma.$disconnect();
}

check();
