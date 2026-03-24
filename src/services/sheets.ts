import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
];

const auth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth: auth as any });

export const createSheetForUser = async (phone: string) => {
  const masterId = process.env.GOOGLE_SHEETS_TEMPLATE_ID;
  if (!masterId) throw new Error('GOOGLE_SHEETS_TEMPLATE_ID not set');
  
  // En aquesta Opció B, no creem cap fitxer ni pestanya.
  // Simplement retornem la ID del fitxer MASTER.
  console.log(`Using Master Sheet ${masterId} for user ${phone}`);
  return masterId;
};

export const appendToSheet = async (sheetId: string, data: any) => {
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  // Utilitzem la primera pestanya del fitxer Master
  const sheet = doc.sheetsByIndex[0];
  
  // Map Gemini result back to column headers
  // Expecting columns: ID_Usuari, Data, Comerç, Import Total, IVA, Categoria, Imatge
  await sheet.addRow({
    'ID_Usuari': data.phone || '',
    'Data': data.data || '',
    'Comerç': data.comerç || '',
    'Import Total': data.import_total || '',
    'IVA': data.iva || '',
    'Categoria': data.categoria || '',
    'Imatge': data.imageUrl || ''
  });
};
