import * as dotenv from 'dotenv';
dotenv.config();
import * as geminiService from '../src/services/gemini';
import * as sheetsService from '../src/services/sheets';
import * as fs from 'fs';

async function testRealImage() {
  const imagePath = 'C:\\Users\\dave_\\.gemini\\antigravity\\brain\\a3d99d8c-ace8-410b-bff8-be1b4457f6db\\media__1774193800834.jpg';
  const masterId = process.env.GOOGLE_SHEETS_TEMPLATE_ID;

  console.log('Reading image...');
  const base64Image = fs.readFileSync(imagePath).toString('base64');

  console.log('Analyzing receipt with Gemini...');
  try {
    const analysis = await geminiService.analyzeReceipt(base64Image);
    console.log('Analysis result:', JSON.stringify(analysis, null, 2));

    console.log(`Appending to Master Sheet ${masterId}...`);
    await sheetsService.appendToSheet(masterId as string, {
      ...analysis,
      phone: '34699000111', // Mock phone
      imageUrl: 'https://example.com/real-test-receipt.jpg'
    });
    console.log('✅ Success! Everything worked.');
  } catch (error: any) {
    console.error('❌ Error during test:', error.message);
  }
}

testRealImage();
