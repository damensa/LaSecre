import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  console.log('--- GEMINI DEBUG (Production Info) ---');
  console.log('Key prefix:', apiKey.substring(0, 10));
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp'
  ];
  
  console.log('Checking model availability inside container:');
  for (const m of modelsToTry) {
      try {
          const model = genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent("test");
          await result.response;
          console.log(`✅ ${m}: AVAILABLE`);
      } catch (e: any) {
          console.log(`❌ ${m}: UNAVAILABLE (${e.message.split('\n')[0]})`);
      }
  }
}

listModels();
