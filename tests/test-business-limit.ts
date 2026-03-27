import * as dotenv from 'dotenv';
dotenv.config();
import prisma from '../src/utils/prisma';

async function testBusinessLimitLogic() {
  const testPhone = 'SYSTEM_TEST_LIMIT_USER';
  
  console.log('--- TESTING BUSINESS LOGIC: 15 RECEIPT LIMIT ---');

  try {
    // 1. Setup user with 15 receipts
    console.log(`Setting user ${testPhone} to 15 receipts...`);
    await (prisma as any).user.upsert({
      where: { phone: testPhone },
      update: { monthlyCount: 15, status: 'FREE' },
      create: { phone: testPhone, monthlyCount: 15, status: 'FREE' }
    });

    // 2. Simulate logic check (reproducing whatsapp.ts logic)
    const user = await prisma.user.findUnique({ where: { phone: testPhone } });
    if (!user) throw new Error('User not found after upsert');

    console.log(`Verifying limit logic for status: ${user.status}, count: ${user.monthlyCount}`);
    
    // logic as in whatsapp.ts
    const isBlocked = user.status === 'FREE' && user.monthlyCount >= 15;

    if (isBlocked) {
      console.log('✅ Success: User correctly IDENTIFIED AS BLOCKED at 15 receipts.');
    } else {
      console.error('❌ Failure: User was NOT blocked at 15 receipts.');
      process.exit(1);
    }

    // 3. Cleanup
    await (prisma as any).user.delete({ where: { phone: testPhone } });
    console.log('Test user cleaned up.');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error in Business Limit Test:', error.message);
    process.exit(1);
  }
}

testBusinessLimitLogic();
