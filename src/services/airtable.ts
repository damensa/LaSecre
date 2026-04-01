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
              'CIF': data.cif || '',
              'Num_Factura': data.numero_factura || '',
              'Tipus_Document': data.tipus_document || '',
              'Import_Total': data.import_total || 0,
              'Quota_IVA': data.import_iva || 0,
              'Percentatge_IVA': data.percentatge_iva || 0,
              'Base_Imposable': data.base_imposable || 0,
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

export const getTicketsByQuarter = async (userPhone: string, startDate: Date, endDate: Date) => {
  const { apiKey, baseId, tableName } = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${baseId}/${tableName}`;

  const formula = `AND({ID_Usuari} = '${userPhone}', {Data_Registre} >= '${startDate.toISOString()}', {Data_Registre} <= '${endDate.toISOString()}')`;
  
  console.log(`[Airtable] Fetching records for ${userPhone} between ${startDate.toISOString()} and ${endDate.toISOString()}`);

  try {
    const response = await axios.get(url, {
      params: {
        filterByFormula: formula,
        sort: [{ field: 'Data_Registre', direction: 'asc' }]
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      }
    });

    return (response.data as any).records.map((r: any) => ({
      createdAt: new Date(r.fields['Data_Registre']),
      date: r.fields['Data_Tiquet'],
      merchant: r.fields['Comerç'],
      cif: r.fields['CIF'],
      invoiceNumber: r.fields['Num_Factura'],
      invoiceType: r.fields['Tipus_Document'],
      total: r.fields['Import_Total'],
      vat: r.fields['Quota_IVA'],
      vatPercentage: r.fields['Percentatge_IVA'],
      baseAmount: r.fields['Base_Imposable'],
      category: r.fields['Categoria'],
      imageUrl: r.fields['Foto']?.[0]?.url || ''
    }));
  } catch (error: any) {
    if (error.response) {
      console.error('Airtable Fetch Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error connecting to Airtable:', error.message);
    }
    throw error;
  }
};
