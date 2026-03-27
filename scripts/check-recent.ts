import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const lastMessages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('--- Last Messages ---');
  console.log(JSON.stringify(lastMessages, null, 2));

  const lastWebhooks = await (prisma as any).webhookEvent.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10
  });
  console.log('\n--- Last Webhook Events ---');
  console.log(JSON.stringify(lastWebhooks, null, 2));
  
  await prisma.$disconnect();
}

check();
