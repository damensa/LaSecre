import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  console.log('--- Current Time:', new Date().toISOString());
  
  const lastMessages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('\n--- Last 5 Messages ---');
  lastMessages.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] ${m.role}: ${m.content.substring(0, 50)}...`);
  });

  const lastWebhooks = await prisma.webhookEvent.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  console.log('\n--- Last 5 Webhook Events ---');
  lastWebhooks.forEach(w => {
    console.log(`[${w.timestamp.toISOString()}] ${w.messageId} - ${w.status}`);
  });
  
  await prisma.$disconnect();
}

check();
