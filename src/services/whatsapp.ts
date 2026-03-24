import axios from 'axios';
import fs from 'fs';

const WHATSAPP_API_URL = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

export const sendWhatsAppMessage = async (to: string, message: string) => {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
};

export const downloadMedia = async (mediaId: string) => {
  const urlResponse = await axios.get(
    `https://graph.facebook.com/v17.0/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    }
  );
  
  const mediaUrl = (urlResponse.data as any).url;
  const imageResponse = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    responseType: 'arraybuffer',
  });
  
  return Buffer.from(imageResponse.data as ArrayBuffer).toString('base64');
};
export const uploadMedia = async (filePath: string, fileType: string) => {
  const formData = new (require('form-data'))();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('type', fileType);
  formData.append('messaging_product', 'whatsapp');

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          ...formData.getHeaders(),
        },
      }
    );
    return (response.data as any).id;
  } catch (error: any) {
    console.error('Error uploading media:', error.response?.data || error.message);
    throw error;
  }
};

export const sendWhatsAppDocument = async (to: string, mediaId: string, filename: string) => {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'document',
        document: {
          id: mediaId,
          filename
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error sending WhatsApp document:', error.response?.data || error.message);
    throw error;
  }
};
