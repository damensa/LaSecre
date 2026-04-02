import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_API_KEY || '', {
  apiVersion: '2024-12-18.acacia' as any,
});

export const createCheckoutSession = async (phone: string) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID, // El codi price_... que em passaràs
        quantity: 1,
      },
    ],
    custom_text: {
      submit: {
        message: 'Gràcies per confiar en TuSecre. Ara ja pots oblidar-te del paperam.'
      }
    },
    mode: 'subscription',
    success_url: `${process.env.BASE_URL || 'https://lasecre.vercel.app'}/success`,
    cancel_url: `${process.env.BASE_URL || 'https://lasecre.vercel.app'}/cancel`,
    client_reference_id: phone,
    tax_id_collection: {
      enabled: true,
    },
    billing_address_collection: 'required',
  });

  return session.url;
};

export const verifyWebhook = (body: any, sig: string) => {
  if (process.env.NODE_ENV === 'test' && sig === 'test_sig') {
    return JSON.parse(body.toString());
  }
  return stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET || ''
  );
};
