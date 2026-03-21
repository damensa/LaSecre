import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export const appendToSheet = async (sheetId: string, data: any) => {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];

  await sheet.addRow({
    'ID': data.phone,
    'Data': data.data,
    'Concepte': data.comerç,
    'Total': data.import_total,
    'IVA': data.iva,
    'Imatge': data.imageUrl,
  });
};

export const createSheetFromTemplate = async (userEmail: string) => {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ],
  });

  // Note: Cloning a sheet usually requires the Drive API.
  // This is a simplified version using the spreadsheet ID.
  const templateId = process.env.GOOGLE_SHEETS_TEMPLATE_ID;
  if (!templateId) throw new Error('Template ID not configured');

  // For a real implementation, we would use the Drive API to copy the file.
  // Since we only have google-spreadsheet, we assume the sheet is already shared
  // or we use a more complex flow. For now, let's assume the user provides their own
  // or we have a more manual process, but I'll add the stub.
  console.log(`Creating sheet for ${userEmail} from template ${templateId}`);
  
  // Return a mock ID for now or the template ID for testing
  return templateId; 
};
