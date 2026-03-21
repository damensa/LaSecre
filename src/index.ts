import dotenv from 'dotenv';
dotenv.config();

console.log('DATABASE_URL:', process.env.DATABASE_URL);

import express from 'express';
import { whatsappRouter } from './routes/whatsapp';
import { stripeRouter } from './routes/stripe';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for Stripe Webhook needs raw body
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Routes
app.use('/whatsapp', whatsappRouter);
app.use('/stripe', stripeRouter);

app.get('/health', (req, res) => {
  res.send('LaSecre is alive and kicking!');
});

app.listen(PORT, () => {
  console.log(`🚀 LaSecre is running on port ${PORT}`);
});
