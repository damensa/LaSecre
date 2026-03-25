import axios from 'axios';
import fs from 'fs';

// Access env variables inside functions to ensure they are loaded after dotenv.config()
const getWhatsAppConfig = () => ({
  token: (process.env.WHATSAPP_TOKEN || '').trim(),
  phoneId: (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
});

export const sendWhatsAppMessage = async (to: string, message: string) => {
  const { token, phoneId } = getWhatsAppConfig();
  const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  const normalizedTo = to.trim().replace('+', '');
  
  console.log(`Sending message to: ${normalizedTo}`);

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Meta API Error Details:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error sending WhatsApp message:', error.message);
    }
    throw error;
  }
};

export const downloadMedia = async (mediaId: string) => {
  const { token } = getWhatsAppConfig();
  
  try {
    console.log(`[WhatsApp] Fetching media URL for ID: ${mediaId}`);
    const urlResponse = await axios.get(
      `https://graph.facebook.com/v22.0/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    
    const mediaUrl = (urlResponse.data as any).url;
    console.log(`[WhatsApp] Downloading media from URL: ${mediaUrl}`);
    
    const imageResponse = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
    });
    
    return Buffer.from(imageResponse.data as ArrayBuffer).toString('base64');
  } catch (error: any) {
    console.error('[WhatsApp] downloadMedia error:', error.response?.data || error.message);
    throw error;
  }
};

export const uploadMedia = async (filePath: string, fileType: string) => {
  const { token, phoneId } = getWhatsAppConfig();
  const formData = new (require('form-data'))();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('type', fileType);
  formData.append('messaging_product', 'whatsapp');

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneId}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
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
  const { token, phoneId } = getWhatsAppConfig();
  const url = `https://graph.facebook.com/v22.0/${phoneId}/messages`;

  try {
    const response = await axios.post(
      url,
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
          Authorization: `Bearer ${token}`,
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
