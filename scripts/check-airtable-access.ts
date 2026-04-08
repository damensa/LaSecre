import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function checkAccess() {
  const token = (process.env.AIRTABLE_API_KEY || '').trim();
  console.log('Token prefix:', token.substring(0, 10));

  try {
    const response = await axios.get('https://api.airtable.com/v0/meta/bases', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Token is valid. Bases accessible:', (response as any).data.bases.length);
    
    const baseId = 'appndOAdpKLPx770m';
    console.log(`\nChecking tables for base ${baseId}...`);
    const tablesResponse = await axios.get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Available Tables:', JSON.stringify((tablesResponse as any).data.tables.map((t: any) => ({ id: t.id, name: t.name })), null, 2));
    
    const table = (tablesResponse as any).data.tables[0];
    console.log('\nFields in the first table:', JSON.stringify(table.fields.map((f: any) => f.name), null, 2));
  } catch (error: any) {
    console.error('❌ Access Error:', error.response?.data || error.message);
  }
}

checkAccess();
