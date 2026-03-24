import { Router } from 'express';
import * as stripeService from '../services/stripe';
import * as userService from '../services/user';

export const stripeRouter = Router();

// Lògica per gestionar avisos de Stripe (pagaments, baixes, etc.)
stripeRouter.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event;

  try {
    // Stripe requereix el "raw body" per verificar la signatura
    event = stripeService.verifyWebhook(req.body, sig);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gestionem cada tipus d'esdeveniment
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const phone = session.client_reference_id;
      const customerId = session.customer;

      if (phone && customerId) {
        // Enllacem el telèfon amb el Customer ID de Stripe i activem el mode PAID
        await userService.updateStripeCustomerId(phone, customerId);
        await userService.updateUserStatus(phone, 'PAID');
        console.log(`[Stripe] Usuari ${phone} ara d'estat PAID. (Customer: ${customerId})`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      // Quan un usuari cancel·la o se li acaba la subscripció
      const subscription = event.data.object as any;
      const customerId = subscription.customer;

      const user = await userService.getUserByStripeCustomerId(customerId);
      if (user) {
        await userService.updateUserStatus(user.phone, 'FREE');
        console.log(`[Stripe] Usuari ${user.phone} ha cancel·lat. Torna a estat FREE.`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Si falla el cobrament d'un mes
      const invoice = event.data.object as any;
      const customerId = invoice.customer;

      const user = await userService.getUserByStripeCustomerId(customerId);
      if (user) {
        await userService.updateUserStatus(user.phone, 'FREE');
        console.log(`[Stripe] Fallada en el pagament de ${user.phone}. Torna a estat FREE.`);
      }
      break;
    }

    default:
      console.log(`[Stripe] Esdeveniment no gestionat: ${event.type}`);
  }

  res.sendStatus(200);
});
