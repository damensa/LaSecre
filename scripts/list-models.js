const axios = require('axios');
require('dotenv').config();

async function listGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

  console.log('--- LISTING ACCESSIBLE MODELS ---');
  try {
    const response = await axios.get(url);
    const models = response.data.models.map(m => m.name.replace('models/', ''));
    console.log('✅ Models found:', JSON.stringify(models, null, 2));
  } catch (error) {
    console.error('❌ FAILED TO LIST MODELS');
    if (error.response) {
      console.error('Error:', error.response.data.error.message);
    } else {
      console.error('Message:', error.message);
    }
  }
}

listGeminiModels();
