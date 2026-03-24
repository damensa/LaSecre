import * as dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const auth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth: auth as any });

async function createBlankSheet() {
  try {
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `Test Blank Sheet - ${new Date().toISOString()}`,
        },
      },
    });
    console.log('✅ Success! Blank sheet created. New ID:', response.data.spreadsheetId);
  } catch (error: any) {
    console.error('❌ Error creating blank sheet:', error.message);
    if (error.response) {
      console.error('Details:', error.response.data);
    }
  }
}

createBlankSheet();
