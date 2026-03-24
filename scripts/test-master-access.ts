import * as dotenv from 'dotenv';
dotenv.config();
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
];

const auth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

async function testRead() {
  const masterId = process.env.GOOGLE_SHEETS_TEMPLATE_ID; // Assuming it's the same ID for now
  console.log(`Testing access to Master ID: ${masterId}`);
  try {
    const doc = new GoogleSpreadsheet(masterId as string, auth);
    await doc.loadInfo();
    console.log('✅ Success! Accessed Master Spreadsheet:', doc.title);
    const sheet = doc.sheetsByIndex[0];
    console.log('First sheet title:', sheet.title);
  } catch (error: any) {
    console.error('❌ Error accessing sheet:', error.message);
  }
}

testRead();
