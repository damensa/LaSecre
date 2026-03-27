import * as airtableService from '../src/services/airtable';
import dotenv from 'dotenv';

dotenv.config();

async function testAirtable() {
  console.log('--- Testing Airtable Integration ---');
  
  const testData = {
    phone: '34640291370',
    comerç: 'Test Supermarket',
    data: '27/03/2026',
    import_total: 42.50,
    iva: 8.50,
    categoria: 'Food & Dining',
    // Using a sample public image URL for testing
    imageUrl: 'https://images.unsplash.com/photo-1556742049-13d736c7a91d?q=80&w=1000&auto=format&fit=crop'
  };

  try {
    const result = await airtableService.createTicket(testData);
    console.log('✅ Success! Record created in Airtable.');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\nCheck your Airtable base to see the new record.');
  } catch (error: any) {
    console.error('❌ Error during Airtable test:', error.message);
  }
}

testAirtable();
