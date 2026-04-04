import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  console.log('--- GEMINI DEBUG ---');
  console.log('Key prefix:', apiKey.substring(0, 10));
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // We try to list models manually since the SDK doesn't expose a direct list method easily in all versions
    // But we can try to "peek" at common models
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp'
    ];
    
    console.log('Checking model availability:');
    for (const m of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            await model.generateContent("test");
            console.log(`✅ ${m}: AVAILABLE`);
        } catch (e: any) {
            console.log(`❌ ${m}: UNAVAILABLE (${e.message.split('\n')[0]})`);
        }
    }
  } catch (error: any) {
    console.error('Fatal debug error:', error.message);
  }
}

listModels();
