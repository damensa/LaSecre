import dotenv from 'dotenv';
dotenv.config();
import * as sheetsService from '../src/services/sheets';

async function testSheetWrite() {
  const masterSheetId = process.env.GOOGLE_SHEETS_TEMPLATE_ID;
  if (!masterSheetId) {
    console.error('❌ GOOGLE_SHEETS_TEMPLATE_ID not found');
    process.exit(1);
  }

  console.log('--- TESTING MASTER SHEET WRITE ---');
  try {
    const testData = {
      comerç: 'TEST_ROBOT',
      data: new Date().toLocaleDateString(),
      import_total: 0.01,
      iva: 0,
      categoria: 'TEST',
      phone: 'SYSTEM_TEST',
      imageUrl: 'http://test.com'
    };

    console.log('Writing test row...');
    await sheetsService.appendToSheet(masterSheetId, testData);
    console.log('✅ Write successful');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to write to Master Sheet:', error.message);
    process.exit(1);
  }
}

testSheetWrite();
