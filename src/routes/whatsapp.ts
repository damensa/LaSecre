import { Router } from 'express';
import * as whatsappService from '../services/whatsapp';
import * as userService from '../services/user';
import * as geminiService from '../services/gemini';
import * as sheetsService from '../services/sheets';
import prisma from '../utils/prisma';

export const whatsappRouter = Router();

whatsappRouter.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

whatsappRouter.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const senderPhone = message.from;
    const messageType = message.type;

    // 1. Check User
    let user = await userService.getUser(senderPhone);
    if (!user) {
      user = await userService.registerUser(senderPhone);
      await whatsappService.sendWhatsAppMessage(senderPhone, "Hola! Soc LaSecre. Ja t'he registrat. Envia'm una foto d'un tiquet i me'n encarrego!");
      return res.sendStatus(200);
    }

    // 2. Handle Text
    if (messageType === 'text') {
      await whatsappService.sendWhatsAppMessage(
        senderPhone, 
        "Sóc LaSecre. No em facis xerrar i envia'm una foto del tiquet, que se'ns passa el trimestre!"
      );
      return res.sendStatus(200);
    }

    // 3. Handle Image
    if (messageType === 'image') {
      // Check limits
      if (user.status === 'FREE' && user.monthlyCount >= 5) {
        await whatsappService.sendWhatsAppMessage(
          senderPhone,
          "Escolta, ja m'has enviat 5 tiquets de franc. Per seguir treballant m'has de convidar a un parell de cafès (15 €). Vols seguir? [Enllaç Stripe]"
        );
        return res.sendStatus(200);
      }

      const mediaId = message.image.id;
      
      // Process
      await whatsappService.sendWhatsAppMessage(senderPhone, "Ho estic mirant... un moment.");

      try {
        const base64Image = await whatsappService.downloadMedia(mediaId);
        const analysis = await geminiService.analyzeReceipt(base64Image);

        // Save to Database
        await prisma.receipt.create({
          data: {
            userPhone: senderPhone,
            merchant: analysis.comerç,
            date: analysis.data,
            total: analysis.import_total,
            vat: analysis.iva,
            category: analysis.categoria,
            imageUrl: mediaId // Store mediaId as a reference
          }
        });

        // Save to Google Sheets if user has one
        if (user.sheetId) {
          await sheetsService.appendToSheet(user.sheetId, {
            ...analysis,
            phone: senderPhone,
            imageUrl: `https://graph.facebook.com/v17.0/${mediaId}`
          });
        }

        // Increment count
        await userService.incrementMonthlyCount(senderPhone);

        // Send character response
        await whatsappService.sendWhatsAppMessage(senderPhone, analysis.resposta_lasecre);

      } catch (error) {
        console.error('Error processing receipt:', error);
        await whatsappService.sendWhatsAppMessage(senderPhone, "Ostres, m'he liat amb aquest tiquet. Torna-m'ho a provar en un moment.");
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Error:', error);
    res.sendStatus(500);
  }
});
