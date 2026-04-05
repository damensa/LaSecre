import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

console.log('--- SERVER STARTUP ---');
console.log('Token Prefix:', process.env.WHATSAPP_TOKEN?.substring(0, 15));
console.log('DATABASE_URL:', process.env.DATABASE_URL);

import express from 'express';
import { whatsappRouter } from './routes/whatsapp';
import { stripeRouter } from './routes/stripe';
import * as stripeService from './services/stripe';
import * as airtableService from './services/airtable';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static('public'));

app.get('/politica', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'politica.html'));
});
app.use('/whatsapp', whatsappRouter);
app.use('/', whatsappRouter); // Allows /webhook (GET and POST) directly
app.use('/stripe', stripeRouter);

// Short redirect to Stripe Checkout
app.get('/p/:phone', async (req, res) => {
  const phone = req.params.phone;
  try {
    const checkoutUrl = await stripeService.createCheckoutSession(phone);
    if (!checkoutUrl) throw new Error('No checkout URL generated');
    res.redirect(checkoutUrl);
  } catch (error: any) {
    console.error('[ShortURL] Error redirecting to Stripe:', error.message);
    res.status(500).send('Error redirigint al pagament. Si us plau, proveu-ho més tard.');
  }
});

// Dynamic redirect for Airtable attachments to avoid expired URLs
app.get('/t/:id', async (req, res) => {
  const recordId = req.params.id;
  try {
    const imageUrl = await airtableService.getTicketImageUrl(recordId);
    if (!imageUrl) {
      return res.status(404).send('No s\'ha trobat la imatge d\'aquest tiquet.');
    }
    res.redirect(imageUrl);
  } catch (error: any) {
    console.error(`[Redirect] Error fetching ticket ${recordId}:`, error.message);
    res.status(500).send('Error al carregar la imatge. Si us plau, proveu-ho més tard.');
  }
});

app.get('/health', (req, res) => {
  const envVars = {
    whatsapp: !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    gemini: !!process.env.GEMINI_API_KEY,
    stripe: !!process.env.STRIPE_API_KEY,
    airtable: !!process.env.AIRTABLE_API_KEY && !!process.env.AIRTABLE_BASE_ID,
  };
  
  const isHealthy = Object.values(envVars).every(v => v);
  
  res.status(isHealthy ? 200 : 500).json({
    status: isHealthy ? 'ok' : 'error',
    message: 'TuSecre is alive and kicking!',
    checks: envVars
  });
});

app.listen(PORT, () => {
  console.log(`🚀 TuSecre is running on port ${PORT}`);
});
