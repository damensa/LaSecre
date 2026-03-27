const axios = require('axios');
require('dotenv').config();

async function testGeminiDirect() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  console.log('--- TESTING GEMINI DIRECT HTTP ---');
  try {
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: 'Hola' }] }]
    });
    console.log('✅ GEMINI HTTP SUCCESS!');
    console.log('Response:', response.data.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error('❌ GEMINI HTTP FAILURE!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
  }
}

testGeminiDirect();
