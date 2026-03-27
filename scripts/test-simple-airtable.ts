import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testSimple() {
  const token = (process.env.AIRTABLE_API_KEY || '').trim();
  const baseId = (process.env.AIRTABLE_BASE_ID || '').trim();
  const tableId = 'Table 1';

  try {
    const response = await axios.post(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        records: [
          {
            fields: {
              'Name': 'Test Connection',
              'Notes': 'This is a test from the bot.'
            }
          }
        ]
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    console.log('✅ Success! Record created.', response.data.records[0].id);
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testSimple();
