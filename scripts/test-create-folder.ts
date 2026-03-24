import * as dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];

const auth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth: auth as any });

async function createFolder() {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: `Test Folder - ${new Date().toISOString()}`,
        mimeType: 'application/vnd.google-apps.folder',
      },
    });
    console.log('✅ Success! Folder created. New ID:', response.data.id);
  } catch (error: any) {
    console.error('❌ Error creating folder:', error.message);
    if (error.response) {
      console.error('Details:', error.response.data);
    }
  }
}

createFolder();
