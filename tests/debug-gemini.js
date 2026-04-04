const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  console.log('--- GEMINI DEBUG (JS Version) ---');
  console.log('Key prefix:', apiKey.substring(0, 10));
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const modelsToTry = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp'
  ];
  
  console.log('Checking model availability:');
  for (const m of modelsToTry) {
      try {
          const model = genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent("test");
          await result.response;
          console.log(`✅ ${m}: AVAILABLE`);
      } catch (e) {
          console.log(`❌ ${m}: UNAVAILABLE (${e.message.split('\n')[0]})`);
      }
  }
}

listModels();
