import dotenv from 'dotenv';
dotenv.config();

console.log('--- SERVER STARTUP ---');
console.log('Token Prefix:', process.env.WHATSAPP_TOKEN?.substring(0, 15));
console.log('DATABASE_URL:', process.env.DATABASE_URL);

import express from 'express';
import { whatsappRouter } from './routes/whatsapp';
import { stripeRouter } from './routes/stripe';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/whatsapp', whatsappRouter);
app.use('/stripe', stripeRouter);

app.get('/health', (req, res) => {
  const envVars = {
    whatsapp: !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    gemini: !!process.env.GEMINI_API_KEY,
    stripe: !!process.env.STRIPE_API_KEY,
    google: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL && !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
  };
  
  const isHealthy = Object.values(envVars).every(v => v);
  
  res.status(isHealthy ? 200 : 500).json({
    status: isHealthy ? 'ok' : 'error',
    message: 'LaSecre is alive and kicking!',
    checks: envVars
  });
});

app.listen(PORT, () => {
  console.log(`🚀 LaSecre is running on port ${PORT}`);
});
