import { Router } from 'express';
import * as whatsappService from '../services/whatsapp';
import fs from 'fs';
import path from 'path';
import * as userService from '../services/user';
import * as geminiService from '../services/gemini';
import * as airtableService from '../services/airtable';
import * as stripeService from '../services/stripe';
import prisma from '../utils/prisma';

export const whatsappRouter = Router();
const processedMessages = new Set<string>();

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
  // 1. Respond 200 OK Immediately to Meta to prevent retries
  res.sendStatus(200);
  fs.writeFileSync('webhook_body.json', JSON.stringify(req.body, null, 2));

  // 2. Process in background
  (async () => {
    try {
      const entry = req.body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      const statusUpdate = value?.statuses?.[0];

      if (statusUpdate) {
        console.log(`[Webhook] Received status update (${statusUpdate.status}) for ID: ${statusUpdate.id}`);
        return;
      }

      if (!message) return;

      const messageId = message.id;
      const senderPhone = message.from;
      const messageType = message.type;
      const text = message.text?.body || '';

      console.log(`[Webhook] Processing ${messageType} from ${senderPhone}: "${text}" (ID: ${messageId})`);

      // 3. Persistent Deduplication (Memory + DB)
      if (processedMessages.has(messageId)) {
        console.log(`[Deduplicator] Ignoring duplicate message (Memory): ${messageId}`);
        return;
      }
      processedMessages.add(messageId);
      
      try {
        await (prisma as any).webhookEvent.create({
          data: { messageId, status: 'RECEIVED' }
        });
      } catch (dbError: any) {
        // P2002 is Prisma unique constraint error
        if (dbError.code === 'P2002') {
          console.log(`[Deduplicator] Ignoring duplicate message (DB): ${messageId}`);
          return;
        }
        console.warn('DB Deduplication warning:', dbError.message);
      }
      processedMessages.add(messageId);

      // Log the incoming message for debugging
      console.log(`[Webhook] Processing message ${messageId} from ${senderPhone}`);

      // 4. Handle User Logic
      let user = await userService.getUser(senderPhone);
      if (!user) {
        user = await userService.registerUser(senderPhone);
        
        // Send welcome logo (realistic photography)
        try {
          const logoPath = path.join(process.cwd(), 'Logo_small.png');
          if (fs.existsSync(logoPath)) {
            const mediaId = await whatsappService.uploadMedia(logoPath, 'image/png');
            await whatsappService.sendWhatsAppImage(senderPhone, mediaId, "Ei, jefe! Soc LaSecre.");
          }
        } catch (logoError) {
          console.error('Error sending welcome logo:', logoError);
        }

        await whatsappService.sendWhatsAppMessage(
          senderPhone, 
          "Ei, jefe! Soc LaSecre. Ja t'he registrat i estic a punt per rebre els teus tiquets. Tens **30 dies de prova de franc** per enviar-me tot el que vulguis. Al sac!\n\nPD: Si vols que enviï el resum al teu gestor (que ja ens coneixem...), digues-me: 'gestor elseu@email.com'"
        );
        return;
      }

      // 5. Handle Text
      if (messageType === 'text') {
        const text = message.text.body;

        // Fetch last 6 messages for context
        const history = await (prisma as any).message.findMany({
          where: { userPhone: senderPhone },
          orderBy: { createdAt: 'desc' },
          take: 6
        });

        const formattedHistory = history.reverse().map((m: any) => ({
          role: (m.role === 'model' ? 'model' : 'user') as 'model' | 'user',
          parts: [{ text: m.content }]
        }));

        const result = await geminiService.chatWithContext(formattedHistory, text);

        // Save user message
        await (prisma as any).message.create({
          data: { userPhone: senderPhone, role: 'user', content: text }
        });

        // Save model message
        await (prisma as any).message.create({
          data: { userPhone: senderPhone, role: 'model', content: result.resposta }
        });

        // Process intents
        if (result.intent === 'SET_ACCOUNTANT' && result.extra?.email) {
          const email = result.extra.email;
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(email)) {
            await userService.updateAccountantEmail(senderPhone, email);
          }
        }

        if (result.intent === 'EXPORT_QUARTER') {
          // Send the explanatory message first (from Gemini)
          await whatsappService.sendWhatsAppMessage(senderPhone, result.resposta);
          
          try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const currentQuarter = Math.floor(currentMonth / 3) + 1;

            const filePath = await require('../services/export').generateQuarterlyExcel(senderPhone, currentYear, currentQuarter);
            
            if (!filePath) {
              await whatsappService.sendWhatsAppMessage(senderPhone, "Ostres, no he trobat cap tiquet d'aquest trimestre per exportar. Envia'm alguna foto primer!");
            } else {
              const mediaId = await whatsappService.uploadMedia(filePath, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              await whatsappService.sendWhatsAppDocument(senderPhone, mediaId, `Resum_LaSecre_Q${currentQuarter}.xlsx`);
              
              const exportMessage = (user as any).accountantEmail 
                ? `Aquí el tens, jefe! Enviat també per correu a ${(user as any).accountantEmail}.`
                : "Aquí el tens, jefe! Ja li pots passar al teu gestor.";
              
              await whatsappService.sendWhatsAppMessage(senderPhone, exportMessage);
            }
          } catch (error) {
            console.error('Export error:', error);
            await whatsappService.sendWhatsAppMessage(senderPhone, "M'he liat intentant fer l'Excel. Torna-m'ho a demanar d'aquí un moment.");
          }
          return;
        }

        // Default response for simple chat or other intents handled by Gemini's text
        await whatsappService.sendWhatsAppMessage(senderPhone, result.resposta);
        return;
      }

      // 6. Handle Image
      if (messageType === 'image') {
        const currentUser = await userService.getUser(senderPhone);
        if (!currentUser) return;

        if (currentUser.status === 'FREE') {
          if (currentUser.monthlyCount >= 15) {
            const checkoutUrl = await stripeService.createCheckoutSession(senderPhone);
            await whatsappService.sendWhatsAppMessage(
              senderPhone,
              `Ei jefe, ja has arribat al límit de 15 tiquets de prova. T'ha agradat estalviar temps? Per seguir amb LaSecre i no tornar a fer Excels a mà, subscriu-te per només **5 €/mes** aquí: ${checkoutUrl}`
            );
            return;
          }
        }

        const mediaId = message.image.id;
        await whatsappService.sendWhatsAppMessage(senderPhone, "Ho estic mirant... un moment.");
        // 4. Background processing logic
        try {
          // Register as PROCESSING immediately
          await (prisma as any).webhookEvent.upsert({
            where: { messageId },
            update: { status: 'PROCESSING' },
            create: { messageId, status: 'PROCESSING' }
          });

          const base64Image = await whatsappService.downloadMedia(mediaId);
          const analysis = await geminiService.analyzeReceipt(base64Image);

          const finalImageUrl = `https://graph.facebook.com/v17.0/${mediaId}`; // Revert to Meta link for now

          await prisma.receipt.create({
            data: {
              userPhone: senderPhone,
              merchant: analysis.comerç,
              date: analysis.data,
              total: analysis.import_total,
              vat: analysis.iva,
              category: analysis.categoria,
              imageUrl: finalImageUrl
            }
          });

          // --- Save to Airtable (Permanent storage with images) ---
          try {
            await airtableService.createTicket({
              ...analysis,
              phone: senderPhone,
              imageUrl: finalImageUrl
            });
            console.log('[Airtable] Ticket created successfully');
          } catch (airtableError: any) {
            console.error('[Airtable] Error saving ticket:', airtableError.message);
          }

          await userService.incrementMonthlyCount(senderPhone);
          const responseMsg = `Ei, jefe. Ja tinc el tiquet de ${analysis.comerç} per ${analysis.import_total} €. Guardat i llistat per desgravar. Ara agafa el paper, fes-ne una pilota i a la paperera, que només agafa pols. Seguim.`;
          await whatsappService.sendWhatsAppMessage(senderPhone, responseMsg);

          // Update status to PROCESSED
          await (prisma as any).webhookEvent.update({
            where: { messageId },
            data: { status: 'PROCESSED' }
          });

        } catch (error) {
          console.error('Error processing receipt:', error);
          await whatsappService.sendWhatsAppMessage(senderPhone, "Escolta, jefe, aquesta foto està més moguda que un ball de festa major. Torna-m'hi a provar o Hisenda no et tornarà ni un cèntim d'això.");
          // Optionally update status to ERROR here
          try {
            await (prisma as any).webhookEvent.update({
              where: { messageId },
              data: { status: 'ERROR', errorMessage: (error as any).message }
            });
          } catch (dbError) {
            console.warn('Failed to update webhookEvent status to ERROR:', (dbError as any).message);
          }
        }
      }
    } catch (error: any) {
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error('Background processing error:', errorDetails);
      fs.appendFileSync('background_error.log', `[${new Date().toISOString()}] ${errorDetails}\n`);
    }
  })();
});
