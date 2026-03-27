import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function initSchema() {
  const token = (process.env.AIRTABLE_API_KEY || '').trim();
  const baseId = (process.env.AIRTABLE_BASE_ID || '').trim();
  const tableId = 'tblYysqcq7REhRcgm'; // From earlier check

  const fieldsToCreate = [
    { name: 'ID_Usuari', type: 'singleLineText' },
    { name: 'Data_Registre', type: 'singleLineText' },
    { name: 'Data_Tiquet', type: 'singleLineText' },
    { name: 'Comerç', type: 'singleLineText' },
    { name: 'Import_Total', type: 'number', options: { precision: 2 } },
    { name: 'Quota_IVA', type: 'number', options: { precision: 2 } },
    { name: 'Categoria', type: 'singleLineText' },
    { name: 'Estat', type: 'singleSelect', options: { choices: [{ name: 'Pendent' }, { name: 'Completat' }] } },
    { name: 'Foto', type: 'multipleAttachments' }
  ];

  console.log(`--- Initializing Schema for Base: ${baseId}, Table: ${tableId} ---`);

  for (const field of fieldsToCreate) {
    try {
      console.log(`Creating field: ${field.name}...`);
      await axios.post(
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
        field,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      console.log(`✅ Field ${field.name} created.`);
    } catch (error: any) {
      if (error.response?.data?.error?.type === 'DUPLICATE_COLUMN_NAME') {
        console.log(`ℹ️ Field ${field.name} already exists.`);
      } else {
        console.error(`❌ Error creating ${field.name}:`, error.response?.data || error.message);
      }
    }
  }
}

initSchema();
