import * as dotenv from 'dotenv';
dotenv.config();
import * as sheetsService from '../src/services/sheets';

async function testAppend() {
  const masterId = process.env.GOOGLE_SHEETS_TEMPLATE_ID;
  const mockData = {
    phone: '34699000111',
    data: '2026-03-22',
    comerç: 'Mercadona',
    import_total: '15.50',
    iva: '4%',
    categoria: 'Menjar',
    imageUrl: 'https://example.com/mock-receipt.jpg'
  };

  console.log(`Testing append to Master ID: ${masterId}`);
  try {
    await sheetsService.appendToSheet(masterId as string, mockData);
    console.log('✅ Success! Data appended to Master Spreadsheet.');
  } catch (error: any) {
    console.error('❌ Error appending to sheet:', error.message);
  }
}

testAppend();
