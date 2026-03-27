import * as whatsappService from '../src/services/whatsapp';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function initBranding() {
  console.log('--- LaSecre Branding Initialization ---');
  
  const logoPath = path.join(process.cwd(), 'Logo_small.png');
  
  if (!fs.existsSync(logoPath)) {
    console.error(`Error: ${logoPath} not found. Please run the resize step first.`);
    return;
  }

  try {
    console.log('Updating WhatsApp profile photo...');
    const result = await whatsappService.updateProfilePhoto(logoPath);
    console.log('Success! Profile photo updated.');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    console.log('\n--- Branding complete! ---');
    console.log('New users will now also receive this logo as a welcome message.');
  } catch (error: any) {
    console.error('Failed to update branding:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

initBranding();
