import * as dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });
    const result = await model.generateContent('Digue\'m hola en català.');
    console.log('Gemini says:', result.response.text());
  } catch (error: any) {
    console.error('❌ Error diag:', error.message);
  }
}

listModels();
