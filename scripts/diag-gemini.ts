import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  try {
    // Note: The SDK might not have a direct listModels without a weird internal call, 
    // but we can try to use a known stable model name.
    console.log('Testing gemini-2.0-flash...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('Hola');
    console.log('Result for gemini-2.0-flash:', result.response.text());
  } catch (e: any) {
    console.error('Error with gemini-2.0-flash:', e.message);
    
    try {
      console.log('Testing gemini-2.5-flash...');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent('Hola');
      console.log('Result for gemini-pro:', result.response.text());
    } catch (e2: any) {
      console.error('Error with gemini-pro:', e2.message);
    }
  }
}

listModels();
