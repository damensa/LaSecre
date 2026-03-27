import * as dotenv from 'dotenv';
dotenv.config();
import * as geminiService from '../src/services/gemini';
import * as fs from 'fs';
import path from 'path';

async function testGeminiParser() {
  const imagePath = path.join(__dirname, 'assets', 'standard-receipt.jpg');
  
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found at ${imagePath}`);
    process.exit(1);
  }

  console.log('--- TESTING GEMINI PARSER ---');
  console.log('Reading image...');
  const base64Image = fs.readFileSync(imagePath).toString('base64');

  console.log('Analyzing receipt with Gemini...');
  try {
    const analysis = await geminiService.analyzeReceipt(base64Image);
    console.log('Analysis result:', JSON.stringify(analysis, null, 2));

    const requiredFields = ['comerç', 'data', 'import_total', 'iva', 'categoria'];
    const missingFields = requiredFields.filter(f => !analysis[f]);

    if (missingFields.length > 0) {
      console.error('❌ Missing fields in JSON:', missingFields.join(', '));
      process.exit(1);
    }

    if (typeof analysis.import_total !== 'number') {
      console.error('❌ import_total is not a number');
      process.exit(1);
    }

    console.log('✅ Gemini Parser test PASSED');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error during Gemini test:', error.message);
    process.exit(1);
  }
}

testGeminiParser();
