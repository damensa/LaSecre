import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import stream from 'stream';
import * as dotenv from 'dotenv';
dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const auth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth: auth as any });

async function testTinyUpload() {
  const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID;
  console.log(`Testing upload to folder: ${folderId}`);
  
  const bufferStream = new stream.PassThrough();
  bufferStream.end('Hello drive');

  try {
    const response = await drive.files.create({
      requestBody: {
        name: 'test_lasecre.txt',
        parents: folderId ? [folderId] : undefined,
        mimeType: 'text/plain',
      },
      media: {
        mimeType: 'text/plain',
        body: bufferStream,
      },
      fields: 'id',
    });
    console.log('✅ Tiny upload success! ID:', response.data.id);
  } catch (error: any) {
    console.error('❌ Tiny upload failed:', error.message);
    if (error.response) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTinyUpload();
