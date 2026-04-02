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

      // Extract text body if available for late use (language detection, etc.)
      const incomingText = message.text?.body || '';

      // 4. Handle User Logic
      let user = await userService.getUser(senderPhone);
      if (!user) {
        user = await userService.registerUser(senderPhone);
        
        // Language detection based on the first message
        // Prioritize Catalan specific words to avoid false positives with "el"
        const isCatalan = /\b(vull|meu|tiquet|amb|per|els)\b/i.test(incomingText);
        const isSpanish = !isCatalan;
        
        // 1. Send welcome logo
        try {
          // Use the correct logo path in public/
          const logoPath = path.join(process.cwd(), 'public', 'logo_LaSecre.PNG');
          if (fs.existsSync(logoPath)) {
            const mediaId = await whatsappService.uploadMedia(logoPath, 'image/png');
            await whatsappService.sendWhatsAppImage(senderPhone, mediaId);
          } else {
            console.warn('[Onboarding] Logo file not found at:', logoPath);
          }
        } catch (logoError) {
          console.error('[Onboarding] Error sending welcome logo:', logoError);
        }

        // 2. Welcome Message Sequence
        if (isSpanish) {
          await whatsappService.sendWhatsAppMessage(
            senderPhone, 
            "¡Hola jefe! 👔 Soy LaSecre. Ya te he activado tu **mes de prueba gratis**. Mi misión es que no vuelvas a picar ni un ticket a mano."
          );
          await whatsappService.sendWhatsAppMessage(
            senderPhone, 
            "Cómo funciono: Cada vez que tengas un ticket o factura, **hazle una foto y mándamela por aquí mismo**. Yo leo el importe, el IVA y lo guardo todo por ti."
          );
          await whatsappService.sendWhatsAppMessage(
            senderPhone, 
            "Para probar, ¿por qué no me pasas una foto de un café o de una factura que tengas por ahí? ¡A ver qué tal leo! 📸\n\nPD: Si quieres que envíe el resumen a tu gestor automáticamente, dime: 'gestor elcorreo@detugestor.com'"
          );
        } else {
          await whatsappService.sendWhatsAppMessage(
            senderPhone, 
            "Ei, jefe! 👔 Soc LaSecre. Ja t'he activat el teu **mes de prova de franc**. La meva missió és que no tornis a picar ni un tiquet a mà."
          );
          await whatsappService.sendWhatsAppMessage(
            senderPhone, 
            "Com funciona: Cada vegada que tinguis un tiquet o factura, **fes-li una foto i envia-me-la per aquí**. Jo llegiré l'import, l'IVA i ho guardaré tot per tu."
          );
          await whatsappService.sendWhatsAppMessage(
            senderPhone, 
            "Per provar-ho, per què no m'envies una foto d'un cafè o d'una factura que tinguis a mà? A veure què tal llegeixo! 📸\n\nPD: Si vols que enviï el resum al teu gestor automàticament, digues-me: 'gestor elseu@email.com'"
          );
        }
        return;
      }

      // 4.5. Check Trial Expiration for existing FREE users
      // This applies to both TEXT and IMAGE messages
      if (user.status === 'FREE') {
        const trialDays = 30;
        const createdAt = new Date(user.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > trialDays) {
          // Determine language context for the expiration message
          const isSpanish = /[¿¡]|\b(quiero|mi|papeleo|pasa|por)\b/i.test(incomingText);
          
          const checkoutUrl = await stripeService.createCheckoutSession(senderPhone);
          const limitMsg = isSpanish 
            ? `Ei jefe, se ha acabado el periquito. El mes de prueba ha volado. Si quieres seguir con el servicio y que me encargue de tu papeleo, pasa por caja aquí: ${checkoutUrl}`
            : `Ei jefe, s'ha acabat el periquito. El mes de prova ha volat. Si vols seguir amb el servei i que m'encarregui de la teva paperassa, passa per caixa aquí: ${checkoutUrl}`;
          
          await whatsappService.sendWhatsAppMessage(senderPhone, limitMsg);
          return;
        }
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
          // Determine language context
          const historyText = history.map((m: any) => m.content).join(' ');
          const isSpanish = /[¿¡]|\b(y|el|los|las|por|con|pero|como)\b/i.test(historyText);

          // Send the explanatory message first (from Gemini)
          await whatsappService.sendWhatsAppMessage(senderPhone, result.resposta);
          
          try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const currentQuarter = Math.floor(currentMonth / 3) + 1;

            const filePath = await require('../services/export').generateQuarterlyExcel(senderPhone, currentYear, currentQuarter);
            
            if (!filePath) {
              const noReceiptsMsg = isSpanish 
                ? "Ostras, no he encontrado ningún ticket de este trimestre para exportar. ¡Envíame alguna foto primero!"
                : "Ostres, no he trobat cap tiquet d'aquest trimestre per exportar. Envia'm alguna foto primer!";
              await whatsappService.sendWhatsAppMessage(senderPhone, noReceiptsMsg);
            } else {
              const mediaId = await whatsappService.uploadMedia(filePath, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              await whatsappService.sendWhatsAppDocument(senderPhone, mediaId, path.basename(filePath));
              
              const exportMessage = (user as any).accountantEmail 
                ? (isSpanish ? `¡Aquí lo tienes, jefe! Enviado también por correo a ${(user as any).accountantEmail}.` : `Aquí el tens, jefe! Enviat també per correu a ${(user as any).accountantEmail}.`)
                : (isSpanish ? "¡Aquí lo tienes, jefe! Ya se lo puedes pasar a tu gestor." : "Aquí el tens, jefe! Ja li pots passar al teu gestor.");
              
              await whatsappService.sendWhatsAppMessage(senderPhone, exportMessage);
            }
          } catch (error) {
            console.error('Export error:', error);
            const errorMsg = isSpanish 
               ? "Me he liado intentando hacer el Excel. Vuélvemelo a pedir en un momento."
               : "M'he liat intentant fer l'Excel. Torna-m'ho a demanar d'aquí un moment.";
            await whatsappService.sendWhatsAppMessage(senderPhone, errorMsg);
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

        const lastMessages = await (prisma as any).message.findMany({
          where: { userPhone: senderPhone, role: 'model' },
          orderBy: { createdAt: 'desc' },
          take: 2
        });
        const historyText = lastMessages.map((m: any) => m.content).join(' ');
        const isSpanish = /[¿¡]|\b(y|el|los|las|por|con|pero|como)\b/i.test(historyText);
        const langHint = isSpanish ? "Castellano" : "Català";

        // Trial check now handled globally above


        const mediaId = message.image.id;
        const waitMsg = isSpanish ? "Lo estoy mirando... un momento." : "Ho estic mirant... un moment.";
        await whatsappService.sendWhatsAppMessage(senderPhone, waitMsg);
        // 4. Background processing logic
        try {
          // Register as PROCESSING immediately
          await (prisma as any).webhookEvent.upsert({
            where: { messageId },
            update: { status: 'PROCESSING' },
            create: { messageId, status: 'PROCESSING' }
          });

          const base64Image = await whatsappService.downloadMedia(mediaId);
          const analysis = await geminiService.analyzeReceipt(base64Image, langHint);

          // Save image to public folder to allow Airtable to download it
          const host = req.get('host');
          const baseUrl = process.env.PUBLIC_URL || `https://${host}`;
          const uploadsDir = path.join(process.cwd(), 'public', 'temp_uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const imagePath = path.join(uploadsDir, `${mediaId}.jpg`);
          fs.writeFileSync(imagePath, Buffer.from(base64Image, 'base64'));

          const finalImageUrl = `${baseUrl}/temp_uploads/${mediaId}.jpg`;

          await prisma.receipt.create({
            data: {
              userPhone: senderPhone,
              merchant: analysis.comerç,
              date: analysis.data,
              total: analysis.import_total,
              vat: analysis.import_iva,
              vatPercentage: analysis.percentatge_iva,
              baseAmount: analysis.base_imposable,
              category: analysis.categoria,
              cif: analysis.cif,
              invoiceNumber: analysis.numero_factura,
              invoiceType: analysis.tipus_document,
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
          const responseMsg = analysis.resposta_lasecre || `¡Recibido! He registrado tu gasto de ${analysis.import_total} € en ${analysis.comerç}. Ya lo tienes en tu panel de Effiguard. Recuerda guardar el papel en tu carpeta de seguridad.`;
          await whatsappService.sendWhatsAppMessage(senderPhone, responseMsg);

          // Update status to PROCESSED
          await (prisma as any).webhookEvent.update({
            where: { messageId },
            data: { status: 'PROCESSED' }
          });

        } catch (error) {
          console.error('Error processing receipt:', error);
          const errorMsg = isSpanish 
             ? "Oye jefe, esta foto está muy borrosa y no veo nada. Vuelve a intentarlo o Hacienda no te devolverá ni un céntimo de esto."
             : "Escolta, jefe, aquesta foto està més moguda que un ball de festa major. Torna-m'hi a provar o Hisenda no et tornarà ni un cèntim d'això.";
          await whatsappService.sendWhatsAppMessage(senderPhone, errorMsg);
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
