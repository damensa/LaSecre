import { Router } from 'express';
import * as whatsappService from '../services/whatsapp';
import * as userService from '../services/user';
import * as geminiService from '../services/gemini';
import * as sheetsService from '../services/sheets';
import * as stripeService from '../services/stripe';
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
      
      try {
        const sheetId = await sheetsService.createSheetForUser(senderPhone);
        await userService.updateUserSheet(senderPhone, sheetId);
        await whatsappService.sendWhatsAppMessage(
          senderPhone, 
          "Ei, jefe! Soc LaSecre. Ja t'he registrat i estic preparant el teu full de càlcul. Tens **30 dies de prova de franc** per enviar-me tots els tiquets que vulguis. Al sac!\n\nPD: Si vols que enviï el resum al teu gestor (que ja ens coneixem...), digues-me: 'gestor elseu@email.com'"
        );
      } catch (error) {
        console.error('Error creating user sheet:', error);
        await whatsappService.sendWhatsAppMessage(
          senderPhone, 
          "Ei, jefe! Soc LaSecre. Ja t'he registrat. Tens **30 dies de prova de franc**. Envia'm la foto del paperet i deixem de perdre el temps.\n\nPD: Si vols configurar el teu gestor: 'gestor elseu@email.com'"
        );
      }
      return res.sendStatus(200);
    }

    // 2. Handle Text
    if (messageType === 'text') {
      const text = message.text.body.toLowerCase().trim();

      // Set Accountant Email
      if (text.startsWith('gestor')) {
        const email = text.replace('gestor', '').trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (emailRegex.test(email)) {
          await userService.updateAccountantEmail(senderPhone, email);
          await whatsappService.sendWhatsAppMessage(
            senderPhone, 
            `Molt bé! Ja tinc l'email del teu gestor (${email}). Quan vulguis exportar el trimestre, només m'ho has de dir.`
          );
        } else {
          await whatsappService.sendWhatsAppMessage(
            senderPhone, 
            "Escolti jefe, aquest email no és pas correcte. Provi així: 'gestor elteu@email.com'"
          );
        }
        return res.sendStatus(200);
      }

      // Export Quarter
      if (text.includes('exportar') || text.includes('trimestre')) {
        await whatsappService.sendWhatsAppMessage(senderPhone, "D'acord, estic preparant el resum del trimestre... Un moment.");
        
        try {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const currentQuarter = Math.floor(currentMonth / 3) + 1;

          const filePath = await require('../services/export').generateQuarterlyExcel(senderPhone, currentYear, currentQuarter);
          
          if (!filePath) {
            await whatsappService.sendWhatsAppMessage(
              senderPhone, 
              "Ostres, no he trobat cap tiquet d'aquest trimestre per exportar. Envia'm alguna foto primer!"
            );
            return res.sendStatus(200);
          }

          const mediaId = await whatsappService.uploadMedia(filePath, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          await whatsappService.sendWhatsAppDocument(senderPhone, mediaId, `Resum_LaSecre_Q${currentQuarter}.xlsx`);
          
          const exportMessage = (user as any).accountantEmail 
            ? `Aquí el tens, jefe! Al sac i ben lligat. També l'he enviat per correu a ${(user as any).accountantEmail}.`
            : "Aquí el tens, jefe! Al sac i ben lligat. Ja li pots passar al teu gestor.";
          
          await whatsappService.sendWhatsAppMessage(senderPhone, exportMessage);

          if ((user as any).accountantEmail) {
            // TODO: Implementar enviament d'email real aquí (p.ex. amb Nodemailer o SendGrid)
            console.log(`Simulant enviament d'email a ${(user as any).accountantEmail} amb el fitxer ${filePath}`);
          }
        } catch (error) {
          console.error('Export error:', error);
          await whatsappService.sendWhatsAppMessage(senderPhone, "M'he liat intentant fer l'Excel. Torna-m'ho a demanar d'aquí un moment.");
        }
        return res.sendStatus(200);
      }

      await whatsappService.sendWhatsAppMessage(
        senderPhone, 
        "Molt bonic el que em dius, jefe, però jo menjo fotos de tiquets. Envia'm el paperet i deixa't de romanços. O digues 'exportar' si vols el resum."
      );
      return res.sendStatus(200);
    }

    // 3. Handle Image
    if (messageType === 'image') {
      // Check Subscription
      if (user.status === 'FREE') {
        const trialDays = 30;
        const now = new Date();
        const trialExpiration = new Date(user.createdAt);
        trialExpiration.setDate(trialExpiration.getDate() + trialDays);

        if (now > trialExpiration) {
          const checkoutUrl = await stripeService.createCheckoutSession(senderPhone);
          await whatsappService.sendWhatsAppMessage(
            senderPhone,
            `Ei jefe, el teu mes de prova s'ha acabat. T'ha agradat estalviar temps? Per seguir amb LaSecre i no tornar a fer Excels a mà, subscriu-te per només **5 €/mes** aquí: ${checkoutUrl}`
          );
          return res.sendStatus(200);
        }
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
        await whatsappService.sendWhatsAppMessage(senderPhone, "Escolta, jefe, aquesta foto està més moguda que un ball de festa major. Torna-m'hi a provar o Hisenda no et tornarà ni un cèntim d'això.");
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Error:', error);
    res.sendStatus(500);
  }
});
