import * as dotenv from 'dotenv';
dotenv.config();
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

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

async function testCopy() {
  const templateId = process.env.GOOGLE_SHEETS_TEMPLATE_ID;
  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
  const userEmail = process.env.USER_EMAIL;

  if (!templateId) {
    console.error('❌ GOOGLE_SHEETS_TEMPLATE_ID is not set in .env');
    return;
  }
  
  console.log(`Using Template ID: ${templateId}`);
  console.log(`Using Parent Folder: ${parentFolderId || 'None'}`);

  try {
    const response = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `LaSecre - Test Gemini - ${new Date().toISOString()}`,
        parents: parentFolderId ? [parentFolderId] : undefined,
        keepRevisionForever: false,
      },
      supportsAllDrives: true,
    } as any); // Use as any to bypass some type issues if needed

    const newFileId = response.data.id;
    console.log('✅ Success! File copied. New ID:', newFileId);

    if (userEmail && newFileId) {
      console.log(`Transferring ownership to ${userEmail}...`);
      await drive.permissions.create({
        fileId: newFileId,
        transferOwnership: true,
        moveToNewOwnersRoot: true,
        requestBody: {
          type: 'user',
          role: 'owner',
          emailAddress: userEmail,
        },
      });
      console.log('✅ Ownership transferred!');
    }
  } catch (error: any) {
    console.error('❌ Error in process:', error.message);
    if (error.response) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCopy();
