import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import stream from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const auth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth: auth as any });

/**
 * Uploads a base64 encoded image to Google Drive
 * @param base64Data Base64 string of the image
 * @param fileName Name of the file on Drive
 * @returns The webViewLink of the uploaded file
 */
export const uploadImage = async (base64Data: string, fileName: string): Promise<string> => {
  const folderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_RECEIPTS_FOLDER_ID not set');

  const bufferStream = new stream.PassThrough();
  bufferStream.end(Buffer.from(base64Data, 'base64'));

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'image/jpeg',
    },
    media: {
      mimeType: 'image/jpeg',
      body: bufferStream,
    },
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = response.data.id;
  if (!fileId) throw new Error('Failed to upload file to Google Drive');

  // Make file publicly readable (anyone with the link can view)
  // This is safer for sharing with accountants
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return response.data.webViewLink || '';
};
