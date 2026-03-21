import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_API_KEY || '', {
  apiVersion: '2025-02-11-preview' as any,
});

export const createCheckoutSession = async (phone: string) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'LaSecre - Subscripció Mensual',
          },
          unit_amount: 1500, // 15.00 €
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.BASE_URL}/success`,
    cancel_url: `${process.env.BASE_URL}/cancel`,
    client_reference_id: phone,
  });

  return session.url;
};

export const verifyWebhook = (body: any, sig: string) => {
  return stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET || ''
  );
};
