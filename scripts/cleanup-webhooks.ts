import prisma from '../src/utils/prisma';

async function cleanupWebhook() {
  console.log('--- CLEANING UP WEBHOOK EVENTS ---');
  try {
    const deleted = await (prisma as any).webhookEvent.deleteMany({});
    console.log(`Deleted ${deleted.count} webhook events.`);
    
    const users = await prisma.user.findMany({});
    console.log(`Found ${users.length} users in DB.`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('Error during cleanup:', error.message);
    process.exit(1);
  }
}

cleanupWebhook();
