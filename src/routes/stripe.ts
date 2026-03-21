import { Router } from 'express';

export const stripeRouter = Router();

stripeRouter.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  // Logic to handle Stripe webhooks (payment success)
  res.sendStatus(200);
});
