import axios from 'axios';
import dotenv from 'dotenv';
import prisma from '../src/utils/prisma';
dotenv.config();

async function testStripeWebhook() {
  const PORT = process.env.PORT || 3000;
  const url = `http://localhost:${PORT}/stripe/webhook`;
  const testPhone = 'SYSTEM_TEST_STRIPE';

  console.log('--- TESTING STRIPE WEBHOOK MOCK ---');

  // 1. Ensure test user exists and is FREE
  await (prisma as any).user.upsert({
    where: { phone: testPhone },
    update: { status: 'FREE' },
    create: { phone: testPhone, status: 'FREE' }
  });
  console.log('User status reset to FREE');

  const payload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        client_reference_id: testPhone,
        customer: 'cus_TEST_123'
      }
    }
  };

  try {
    console.log('Sending mock webhook to ' + url);
    const response = await axios.post(url, payload, {
      headers: {
        'stripe-signature': 'test_sig',
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      console.log('✅ Webhook accepted');
      
      // 2. Verify DB change
      const user = await prisma.user.findUnique({ where: { phone: testPhone } });
      if (user?.status === 'PAID') {
        console.log('✅ DB Verification: User is now PAID');
        process.exit(0);
      } else {
        console.error('❌ DB Verification: User status is still ' + user?.status);
        process.exit(1);
      }
    } else {
      console.error('❌ Webhook rejected with status:', response.status);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Failed to reach webhook endpoint. Make sure the server is running (npm run dev)!');
    process.exit(1);
  }
}

testStripeWebhook();
