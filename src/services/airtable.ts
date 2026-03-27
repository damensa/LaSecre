import axios from 'axios';

const getAirtableConfig = () => ({
  apiKey: (process.env.AIRTABLE_API_KEY || '').trim(),
  baseId: (process.env.AIRTABLE_BASE_ID || '').trim(),
  tableName: (process.env.AIRTABLE_TABLE_NAME || 'tblYysqcq7REhRcgm').trim(),
});

export const createTicket = async (data: any) => {
  const { apiKey, baseId, tableName } = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${baseId}/${tableName}`;

  console.log(`[Airtable] Creating record in base ${baseId}, table ${tableName}`);

  try {
    const response = await axios.post(
      url,
      {
        records: [
          {
            fields: {
              'ID_Usuari': data.phone || '',
              'Data_Registre': new Date().toISOString(),
              'Data_Tiquet': data.data || '',
              'Comerç': data.comerç || '',
              'Import_Total': data.import_total || 0,
              'Quota_IVA': data.iva || 0,
              'Categoria': data.categoria || '',
              'Estat': 'Pendent',
              // Airtable Attachment field expects an array of objects with a 'url' property
              // We'll use 'Foto' as the field name for the attachment
              'Foto': [
                {
                  url: data.imageUrl
                }
              ]
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Airtable API Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error connecting to Airtable:', error.message);
    }
    throw error;
  }
};
