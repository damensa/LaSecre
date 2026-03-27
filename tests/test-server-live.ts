const axios = require('axios');
import * as dotenv from 'dotenv';
dotenv.config();

async function testServerLive() {
  const PORT = process.env.PORT || 3000;
  const url = `http://localhost:${PORT}/health`;

  console.log('--- TESTING SERVER LIVE STATUS ---');
  try {
    console.log(`Pinging ${url}...`);
    const response = await axios.get(url);

    if (response.status === 200 && response.data.status === 'ok') {
      console.log('✅ Server is alive and all environment checks PASSED.');
      console.log('Checks details:', JSON.stringify(response.data.checks, null, 2));
      process.exit(0);
    } else {
      console.error('❌ Server responded but state is NOT OK:', response.data);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Could not reach server at localhost:' + PORT);
    console.error('Check if the bot is running (npm run dev).');
    process.exit(1);
  }
}

testServerLive();
