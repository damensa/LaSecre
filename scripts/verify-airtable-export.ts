import dotenv from 'dotenv';
dotenv.config();
import { generateQuarterlyExcel } from '../src/services/export';

async function testExport() {
  const phone = '34640291370';
  const year = 2026;
  const quarter = 1;
  
  console.log('--- Testing Airtable Export ---');
  try {
    const filePath = await generateQuarterlyExcel(phone, year, quarter);
    if (filePath) {
      console.log('SUCCESS! Excel generated at:', filePath);
    } else {
      console.log('NO DATA found for this user/quarter in Airtable.');
    }
  } catch (error) {
    console.error('EXPORT FAILED:', error);
  }
}

testExport();
