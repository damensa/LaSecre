import dotenv from 'dotenv';
dotenv.config();
import * as whatsappService from '../src/services/whatsapp';
import path from 'path';
import fs from 'fs';

async function updateProfile() {
  const logoPath = path.join(process.cwd(), 'public', 'logo_LaSecre.PNG');
  
  if (!fs.existsSync(logoPath)) {
    console.error('Logo file not found at:', logoPath);
    process.exit(1);
  }

  try {
    console.log('Updating WhatsApp profile photo...');
    const result = await whatsappService.updateProfilePhoto(logoPath);
    console.log('Success!', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('Failed to update profile photo:', error.message);
  }
}

updateProfile();
