import { Router } from 'express';
import * as whatsappService from '../services/whatsapp';
import fs from 'fs';
import path from 'path';
import * as userService from '../services/user';
import * as geminiService from '../services/gemini';
import * as fiscalChatService from '../services/fiscal-chat';
import * as receiptFlowService from '../services/receipt-flow';
import * as airtableService from '../services/airtable';
import * as stripeService from '../services/stripe';
import * as emailService from '../services/email';
import prisma from '../utils/prisma';
import { normalizePhone } from '../utils/phone';
import { startOfQuarter, endOfQuarter } from 'date-fns';

export const whatsappRouter = Router();
const processedMessages = new Set<string>();
const MANAGER_REGEX = /gestor[:\s=]*([^\s@]+@[^\s@]+\.[^\s@]+)/i;

function detectCatalan(text: string) {
  return /[l|d]'|'m |ny|l·l|\b(el|la|meu|resum|vull|puc|tiquet|amb|per|els)\b/i.test(text);
}

function detectSpanish(text: string) {
  return /[¿¡]|\b(el|la|mi|resumen|quiero|puedo|pasa|por|papeleo|y|los|las|con|pero|como)\b/i.test(text);
}

function prefersSpanish(currentText: string, fallbackText = '') {
  const isCatalan = detectCatalan(currentText);
  const isSpanish = !isCatalan && detectSpanish(currentText);
  return (isSpanish && !isCatalan) || (!isSpanish && !isCatalan && detectSpanish(fallbackText));
}

async function sendWelcomeSequence(senderPhone: string, incomingText: string) {
  const isCatalan = detectCatalan(incomingText);
  const isSpanish = !isCatalan;

  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo-tusecre_v2.jpg');
    if (fs.existsSync(logoPath)) {
      const mediaId = await whatsappService.uploadMedia(logoPath, 'image/jpeg');
      await whatsappService.sendWhatsAppImage(senderPhone, mediaId);
    } else {
      console.warn('[Onboarding] Logo file not found at:', logoPath);
    }
  } catch (logoError) {
    console.error('[Onboarding] Error sending welcome logo:', logoError);
  }

  const messages = isSpanish
    ? [
        "¡Hola jefe! 👔 Soy TuSecre. Ya te he activado tu **mes de prueba gratis**. Mi misión es que no vuelvas a picar ni un ticket a mano.",
        "Cómo funciono: Cada vez que tengas un ticket o factura, **hazle una foto y mándamela por aquí mismo**. Yo leo el importe, el IVA y lo guardo todo por ti.",
        "Para probar, ¿por qué no me pasas una foto de un café o de una factura que tengas por ahí? ¡A ver qué tal leo! 📸\n\nPD: Si quieres que envíe el resumen a tu gestor automáticamente, dime: 'gestor elcorreo@detugestor.com'\n\nAl usar TuSecre, aceptas nuestra política de privacidad: https://tusecre.cat/politica",
        "¡Ah! Y por cierto jefe, una cosa muy importante: **pásame tu NIF/CIF** cuando puedas. Así, si les haces fotos a tus propias facturas de venta, yo sabré que son tuyas y te las pondré en un apartado separado en tu resumen del Excel. ✨\n\nSolo tienes que escribirme: 'mi NIF es 12345678X' o 'CIF: B12345678'."
      ]
    : [
        "Ei, jefe! 👔 Soc TuSecre. Ja t'he activat el teu **mes de prova de franc**. La meva missió és que no tornis a picar ni un tiquet a mà.",
        "Com funciona: Cada vegada que tinguis un tiquet o factura, **fes-li una foto i envia-me-la per aquí**. Jo llegiré l'import, l'IVA i ho guardaré tot per tu.",
        "Per provar-ho, per què no m'envies una foto d'un cafè o d'una factura que tinguis a mà? A veure què tal llegeixo! 📸\n\nPD: Si vols que enviï el resum al teu gestor automàticament, digues-me: 'gestor elseu@email.com'\n\nEn utilitzar TuSecre, acceptes la nostra política de privacitat: https://tusecre.cat/politica",
        "Ah! I per cert jefe, una cosa molt important: **passa'm el teu NIF/CIF** quan puguis. Així, si fas fotos a les teves pròpies factures de venda, jo sabré que són teves i te les posaré en un apartat separat al teu resum de l'Excel. ✨\n\nNomés m'has d'escriure: 'el meu NIF és 12345678X' o 'CIF: B12345678'."
      ];

  for (const msg of messages) {
    await whatsappService.sendWhatsAppMessage(senderPhone, msg);
  }

  const match = incomingText.match(MANAGER_REGEX);
  if (match) {
    const email = match[1];
    await userService.updateAccountantEmail(senderPhone, email);
    await whatsappService.sendWhatsAppMessage(
      senderPhone,
      isSpanish
        ? `¡Perfecto jefe! He guardado ${email} como tu gestor.`
        : `Perfecte jefe! He guardat ${email} com el teu gestor.`
    );
  }
}

async function processReceiptImage(params: {
  senderPhone: string;
  messageId: string;
  mediaId: string;
  langHint: string;
  isSpanish: boolean;
  userNif?: string;
  host?: string;
}) {
  const { senderPhone, messageId, mediaId, langHint, isSpanish, userNif, host } = params;

  const waitMsg = isSpanish ? 'Lo estoy mirando... un momento.' : 'Ho estic mirant... un moment.';
  await whatsappService.sendWhatsAppMessage(senderPhone, waitMsg);

  try {
    await (prisma as any).webhookEvent.upsert({
      where: { messageId },
      update: { status: 'PROCESSING' },
      create: { messageId, status: 'PROCESSING' }
    });

    const base64Image = await whatsappService.downloadMedia(mediaId);
    const { final: analysis, validation } = await receiptFlowService.runReceiptAnalysisFlow({
      base64Image,
      languageHint: langHint,
      userNif,
    });

    const baseUrl = process.env.PUBLIC_URL || `https://${host}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'temp_uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const imagePath = path.join(uploadsDir, `${mediaId}.jpg`);
    fs.writeFileSync(imagePath, Buffer.from(base64Image, 'base64'));
    const finalImageUrl = `${baseUrl}/temp_uploads/${mediaId}.jpg`;

    await (prisma as any).receipt.create({
      data: {
        userPhone: senderPhone,
        merchant: analysis.comerç,
        date: analysis.data,
        total: Number(analysis.import_total || 0),
        vat: Number(analysis.import_iva || 0),
        vatPercentage: Number(analysis.percentatge_iva || 0),
        baseAmount: Number(analysis.base_imposable || 0),
        category: analysis.categoria,
        cif: analysis.cif,
        invoiceNumber: analysis.numero_factura,
        invoiceType: validation.reviewRequired ? `${analysis.tipus_document} [REVIEW]` : analysis.tipus_document,
        imageUrl: finalImageUrl,
        type: analysis.tipus === 'VENDA' ? 'SALE' : 'PURCHASE',
        retentionAmount: analysis.import_retencio || 0,
        retentionPercentage: analysis.percentatge_retencio || 0,
        aeatSummary: validation.aeatResearch?.summary,
        aeatSources: validation.aeatResearch?.sources?.length ? JSON.stringify(validation.aeatResearch.sources) : null,
        validationIssues: validation.issues.length ? JSON.stringify(validation.issues) : null,
        reviewRequired: validation.reviewRequired
      }
    });

    try {
      await airtableService.createTicket({
        ...analysis,
        phone: senderPhone,
        imageUrl: finalImageUrl,
        aeatSummary: validation.aeatResearch?.summary,
        aeatSources: validation.aeatResearch?.sources,
        validationIssues: validation.issues,
        reviewRequired: validation.reviewRequired
      });
      console.log('[Airtable] Ticket created successfully');
    } catch (airtableError: any) {
      console.error('[Airtable] Error saving ticket:', airtableError.message);
    }

    console.log('[ReceiptFlow] Saved receipt', {
      userPhone: senderPhone,
      merchant: analysis.comerç,
      total: analysis.import_total,
      reviewRequired: validation.reviewRequired,
      validationIssues: validation.issues.length,
      aeatSummary: validation.aeatResearch?.summary || null,
    });

    await userService.incrementMonthlyCount(senderPhone);
    const responseMsg = analysis.resposta_lasecre || `¡Recibido! He registrado tu gasto de ${analysis.import_total} € en ${analysis.comerç}. Ya lo tienes en tu panel de Effiguard. Recuerda guardar el papel en tu carpeta de seguridad.`;
    await whatsappService.sendWhatsAppMessage(senderPhone, responseMsg);

    await (prisma as any).webhookEvent.update({
      where: { messageId },
      data: { status: 'PROCESSED' }
    });
  } catch (error: any) {
    console.error('Error processing receipt:', error);

    const errorString = JSON.stringify(error);
    const isQuotaError = error.message?.includes('429') ||
      error.response?.data?.error?.message?.includes('quota') ||
      errorString.includes('429');
    const isParseError = error.code === 'EXTRACTION_PARSE_FAILED' || error.message?.includes('No JSON object found');
    const isModelUnavailable = error.code === 'MODEL_UNAVAILABLE';
    const isExtractionError = error.code === 'EXTRACTION_FAILED';

    let errorMsg = isSpanish
      ? 'Oye jefe, esta foto está muy borrosa y no veo nada. Vuelve a intentarlo o Hacienda no te devolverá ni un céntimo de esto.'
      : "Escolta, jefe, aquesta foto està més moguda que un ball de festa major. Torna-m'hi a provar o Hisenda no et tornarà ni un cèntim d'això.";

    if (isQuotaError) {
      errorMsg = isSpanish
        ? '¡Ostras jefe! Google me ha cortado el grifo (error de cuota). Espérate un minuto y vuelve a mandarme la foto, que ahora mismo estoy colapsada.'
        : "Ostres jefe! Google m'ha tallat l'aixeta (error de quota). Espera't un minut i torna'm a enviar la foto, que ara mateix estic col·lapsada.";
    } else if (isParseError) {
      errorMsg = isSpanish
        ? 'He podido leer algo, pero el extractor me ha devuelto una respuesta mal montada. Reenvíame la foto y si vuelve a pasar lo reviso yo por dentro.'
        : "He pogut llegir alguna cosa, però l'extractor m'ha tornat una resposta mal muntada. Reenvia'm la foto i si torna a passar ho reviso jo per dins.";
    } else if (isModelUnavailable) {
      errorMsg = isSpanish
        ? 'Hoy tengo un modelo de Google caído o mal configurado. No es tu foto. Dame un momento y lo arreglo.'
        : "Avui tinc un model de Google caigut o mal configurat. No és la teva foto. Dona'm un moment i ho arreglo.";
    } else if (isExtractionError) {
      errorMsg = isSpanish
        ? 'No he sido capaz de sacar los datos del ticket. Puede ser la foto, o puede ser que Google hoy vaya tortuga. Reenvíamela una vez más.'
        : "No he estat capaç de treure les dades del tiquet. Pot ser la foto, o pot ser que Google avui vagi tortuga. Reenvia-me-la una vegada més.";
    }

    await whatsappService.sendWhatsAppMessage(senderPhone, errorMsg);
    try {
      await (prisma as any).webhookEvent.update({
        where: { messageId },
        data: { status: 'ERROR', errorMessage: error.message }
      });
    } catch (dbError: any) {
      console.warn('Failed to update webhookEvent status to ERROR:', dbError.message);
    }
  }
}

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
      const senderPhone = normalizePhone(message.from);
      const messageType = message.type;
      const text = message.text?.body || '';

      console.log(`[Webhook] Processing ${messageType} from ${senderPhone}: "${text}" (ID: ${messageId})`);

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
        if (dbError.code === 'P2002') {
          console.log(`[Deduplicator] Ignoring duplicate message (DB): ${messageId}`);
          return;
        }
        console.warn('DB Deduplication warning:', dbError.message);
      }

      const incomingText = message.text?.body || '';
      let userRow = await prisma.user.findUnique({ where: { phone: senderPhone } });
      let isNewUser = false;

      if (!userRow) {
        try {
          userRow = await prisma.user.create({
            data: {
              phone: senderPhone,
              status: 'FREE',
              monthlyCount: 0,
            },
          });
          isNewUser = true;
        } catch (error: any) {
          if (error?.code === 'P2002') {
            userRow = await prisma.user.findUnique({ where: { phone: senderPhone } });
          } else {
            throw error;
          }
        }
      }

      console.log('[Onboarding] senderPhone:', senderPhone, 'isNewUser:', isNewUser, 'userExists:', !!userRow);

      if (isNewUser) {
        await sendWelcomeSequence(senderPhone, incomingText);
        return;
      }

      if (!userRow) {
        throw new Error(`User row missing after create-or-load for ${senderPhone}`);
      }

      const user = userRow;

      if (user.status === 'FREE') {
        const trialDays = 30;
        const createdAt = new Date(user.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > trialDays) {
          try {
            const isCatalan = detectCatalan(incomingText);
            const isSpanish = !isCatalan && detectSpanish(incomingText);
            
            const shortUrl = `${process.env.BASE_URL || 'https://la-secre-hazel.vercel.app'}/p/${senderPhone}`;
            
            const limitMsg = isSpanish 
              ? `Ei jefe, se ha acabado el periquito. El mes de prueba ha volado. Si quieres seguir con el servicio y que TuSecre se encargue de tu papeleo, pasa por caja aquí: ${shortUrl}`
              : `Ei jefe, s'ha acabat el periquito. El mes de prova ha volat. Si vols seguir amb el servei i que TuSecre s'encarregui de la teva paperassa, passa per caixa aquí: ${shortUrl}`;
            
            await whatsappService.sendWhatsAppMessage(senderPhone, limitMsg);
            return;
          } catch (stripeError: any) {
            console.error('[Stripe] Error creating short link:', stripeError.message);
          }
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

        // --- DIRECT COMMAND DETECTION (NO-IA) ---
        // Improved Regex to allow 'gestor:', 'gestor :', 'gestor=', etc.
        const match = text.match(MANAGER_REGEX);

        let result: any = { resposta: '', intent: 'NONE' };

        if (match) {
            const email = match[1];
            await userService.updateAccountantEmail(senderPhone, email);
            const historyText = history.map((m: any) => m.content).join(' ');
            const isCatalan = detectCatalan(text) || detectCatalan(historyText);

            result.resposta = isCatalan 
                ? `Fet jefe! He guardat ${email} a la teva fitxa. A partir d'ara, quan demanis el resum l'enviaré directament aquí.`
                : `¡Hecho jefe! He guardado ${email} en tu ficha. A partir de ahora, cuando pidas el resumen lo enviaré directamente aquí.`;
            result.intent = 'SET_ACCOUNTANT';

        // --- OPT-OUT/OPT-IN recordatoris fiscals ---
        } else if (/sense recordatoris|sin recordatorios/i.test(text)) {
            await (prisma as any).user.update({ where: { phone: senderPhone }, data: { aeatReminders: false } });
            const historyText = history.map((m: any) => m.content).join(' ');
            const isCat = /[l|d]'|'m |\b(el|la|meu|vull|puc)\b/i.test(text + historyText);
            result.resposta = isCat
                ? 'Entès jefe. Ja no rebràs més recordatoris fiscals de l\'AEAT. Pots reactivar-los quan vulguis escrivint "activa recordatoris".'
                : 'Entendido jefe. Ya no recibirás más recordatorios fiscales de la AEAT. Puedes reactivarlos escribiendo "activa recordatorios".';
            result.intent = 'OPT_OUT_REMINDERS';

        } else if (/activa recordatoris|activa recordatorios/i.test(text)) {
            await (prisma as any).user.update({ where: { phone: senderPhone }, data: { aeatReminders: true } });
            const historyText = history.map((m: any) => m.content).join(' ');
            const isCat = /[l|d]'|'m |\b(el|la|meu|vull|puc)\b/i.test(text + historyText);
            result.resposta = isCat
                ? '✅ Fet jefe! Tornaràs a rebre recordatoris fiscals 7 dies i 2 dies abans de cada venciment de l\'AEAT.'
                : '✅ Hecho jefe! Volverás a recibir recordatorios fiscales 7 días y 2 días antes de cada vencimiento de la AEAT.';
            result.intent = 'OPT_IN_REMINDERS';

        } else {
            // Fiscal questions can enrich the answer with AEAT research, otherwise use normal chat
            result = fiscalChatService.looksLikeFiscalQuestion(text)
              ? await fiscalChatService.chatWithFiscalContext(formattedHistory, text)
              : await geminiService.chatWithContext(formattedHistory, text);
        }

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

        const finalIsSpanish = prefersSpanish(text, history.map((m: any) => m.content).join(' '));

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
              const noReceiptsMsg = finalIsSpanish 
                ? "Ostras, no he encontrado ningún ticket de este trimestre para exportar. ¡Envíame alguna foto primero!"
                : "Ostres, no he trobat cap tiquet d'aquest trimestre per exportar. Envia'm alguna foto primer!";
              await whatsappService.sendWhatsAppMessage(senderPhone, noReceiptsMsg);
            } else {
              const mediaId = await whatsappService.uploadMedia(filePath, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              await whatsappService.sendWhatsAppDocument(senderPhone, mediaId, path.basename(filePath));
              
              // RE-FETCH the latest user info (to get the updated accountantEmail)
              const updatedUser = await userService.getUser(senderPhone);
              const managerEmail = updatedUser?.accountantEmail;

              // Email sending logic
              let emailSent = false;
              if (managerEmail) {
                emailSent = await emailService.sendExcelByEmail(managerEmail, filePath, senderPhone);
              }

              let exportMessage = '';
              if (emailSent) {
                exportMessage = finalIsSpanish 
                    ? `¡Listo jefe! Lo tienes aquí en WhatsApp y también lo he enviado a tu gestor: ${managerEmail}. Ya puedes quitar el cava de la nevera.` 
                    : `Fet jefe! Ja el tens aquí pel WhatsApp i també l'he enviat al teu gestor: ${managerEmail}. Ja pots treure el cava de la nevera.`;
              } else if (managerEmail) {
                // Email was found but NOT sent (SMTP failure)
                exportMessage = finalIsSpanish
                    ? `¡Aquí lo tienes jefe! He intentado enviarlo a ${managerEmail} pero mi servidor de correo (Arsys) ha dado un error. Pásaselo tú mismo mientras lo arreglo.`
                    : `Aquí el tens jefe! He intentat enviar-lo a ${managerEmail} però el meu servidor de correu (Arsys) ha donat un error. Passa-li tu mateix mentre ho arreglo.`;
              } else {
                // No email found
                exportMessage = finalIsSpanish 
                    ? `¡Aquí lo tienes jefe! No he podido enviarlo por email porque no tengo la ficha de tu gestor. Si quieres que se lo pase yo, dime: "gestor: nombre@email.com"` 
                    : `Aquí el tens jefe! No l'he pogut enviar per mail perquè no tinc la fitxa del teu gestor. Si vols que li passi jo, digue'm: "gestor: nom@email.com"`;
              }
              
              await whatsappService.sendWhatsAppMessage(senderPhone, exportMessage);
            }
          } catch (error) {
            console.error('Export error:', error);
            const errorMsg = finalIsSpanish 
               ? "Me he liado intentando hacer el Excel. Vuélvemelo a pedir en un momento."
               : "M'he liat intentant fer l'Excel. Torna-m'ho a demanar d'aquí un moment.";
            await whatsappService.sendWhatsAppMessage(senderPhone, errorMsg);
          }
          return;
        }

        if (result.intent === 'SET_FISCAL_DATA') {
            const fd = (result.extra as any)?.fiscalData;
            if (fd && fd.nif) {
                await userService.updateFiscalData(senderPhone, {
                    fiscalName: fd.name,
                    nif: fd.nif,
                    address: fd.address
                });
                const successMsg = finalIsSpanish
                    ? `¡Perfecto jefe! He guardado tus datos: ${fd.name} (${fd.nif}). Ya lo tengo todo para tus facturas. ✨`
                    : `Perfecte jefe! He guardat les teves dades: ${fd.name} (${fd.nif}). Ja ho tinc tot per a les teves factures. ✨`;
                await whatsappService.sendWhatsAppMessage(senderPhone, successMsg);
                return;
            }
            
            const fiscalPrompt = finalIsSpanish
                ? "¡Claro jefe! Pásame el **Nombre Fiscal**, el **NIF/CIF** y la **Dirección** (calle, CP y ciudad). Así cuando quieras la factura de los 5€ de TuSecre, ya lo tendré todo listo. 👔"
                : "I tant jefe! Passa'm el **Nom Fiscal**, el **NIF/CIF** i l'**Adreça** (carrer, CP i ciutat). Així quan vulguis la factura dels 5€ de TuSecre, ja ho tindré tot llest. 👔";
            await whatsappService.sendWhatsAppMessage(senderPhone, fiscalPrompt);
            return;
        }

        if (result.intent === 'GET_BALANCE') {
            try {
                const now = new Date();
                const year = now.getFullYear();
                const quarter = Math.floor(now.getMonth() / 3) + 1;
                const startDate = startOfQuarter(now);
                const endDate = endOfQuarter(now);

                const records = await airtableService.getTicketsByQuarter(senderPhone, startDate, endDate);
                
                let ivaSoportat = 0; // Compres
                let ivaRepercutit = 0; // Vendes
                let retencionsAbonades = 0; // Vendes (IRPF que t'han retingut)
                let retencionsAPagar = 0; // Compres (IRPF que has de pagar tu a l'AEAT)

                records.forEach((r: any) => {
                    const isSale = r.type === 'SALE' || r.type === 'VENDA';
                    if (isSale) {
                        ivaRepercutit += (r.vat || 0);
                        retencionsAbonades += (r.retention || 0);
                    } else {
                        ivaSoportat += (r.vat || 0);
                        retencionsAPagar += (r.retention || 0);
                    }
                });

                const balancIVA = ivaRepercutit - ivaSoportat;
                
                const balanceMsg = finalIsSpanish
                    ? `📊 *Balanç actual Q${quarter} ${year}*\n\n` +
                      `· IVA a pagar: *${balancIVA.toFixed(2)}€* (Ventas: ${ivaRepercutit.toFixed(2)}€ | Compras: ${ivaSoportat.toFixed(2)}€)\n` +
                      `· Retenciones IRPF a ingresar (Mod. 111): *${retencionsAPagar.toFixed(2)}€*\n` +
                      `· Retenciones sufridas (a cuenta Renta): *${retencionsAbonades.toFixed(2)}€*\n\n` +
                      `_Nota: Aquest càlcul es basa en les fotos que m'has enviat aquest trimestre._`
                    : `📊 *Balanç actual Q${quarter} ${year}*\n\n` +
                      `· IVA a pagar: *${balancIVA.toFixed(2)}€* (Vendes: ${ivaRepercutit.toFixed(2)}€ | Compres: ${ivaSoportat.toFixed(2)}€)\n` +
                      `· Retencions IRPF a ingressar (Mod. 111): *${retencionsAPagar.toFixed(2)}€*\n` +
                      `· Retencions que t'han fet (a compte Renda): *${retencionsAbonades.toFixed(2)}€*\n\n` +
                      `_Nota: Aquest càlcul es basa en les fotos que m'has enviat aquest trimestre._`;

                await whatsappService.sendWhatsAppMessage(senderPhone, balanceMsg);
                return;
            } catch (err) {
                console.error('Balance error:', err);
            }
        }

        if (result.intent === 'DELETE_DATA') {
            try {
                await userService.deleteUser(senderPhone);
                const deleteSuccess = finalIsSpanish
                    ? "Hecho jefe. He borrado todos tus datos, tickets y mensajes de mi sistema. Ha sido un placer. 👔👋"
                    : "Fet jefe. He esborrat totes les teves dades, tiquets i missatges del meu sistema. Ha estat un plaer. 👔👋";
                await whatsappService.sendWhatsAppMessage(senderPhone, deleteSuccess);
            } catch (err) {
                console.error('Delete error:', err);
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
        const isSpanish = prefersSpanish('', historyText);
        const langHint = isSpanish ? 'Castellano' : 'Català';

        await processReceiptImage({
          senderPhone,
          messageId,
          mediaId: message.image.id,
          langHint,
          isSpanish,
          userNif: currentUser?.nif || undefined,
          host: req.get('host') || undefined,
        });
      }
    } catch (error: any) {
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error('Background processing error:', errorDetails);
      fs.appendFileSync('background_error.log', `[${new Date().toISOString()}] ${errorDetails}\n`);
      
      // Notify the user of a fallback error if we have their phone
      try {
        const body = JSON.parse(fs.readFileSync('webhook_body.json', 'utf8'));
        const senderPhone = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
        if (senderPhone) {
            const isCatalan = !(/¿|¡|\b(el|la|mi|tu|su|un|una|pero|con|como)\b/i.test(body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || ''));
            
            const isQuotaError = errorDetails?.includes('429') || errorDetails?.includes('quota');
            
            let failMsg = isCatalan 
                ? "Em sap greu jefe, m'he embolicat intentant processar el teu missatge. Torna-m'ho a dir d'aquí un moment."
                : "Lo siento jefe, me he liado intentando procesar tu mensaje. Vuelve a decírmelo en un momento.";

            if (isQuotaError) {
              failMsg = isCatalan
                ? "Ostres jefe! Google m'ha tallat l'aixeta (error de quota). Espera't un minut i torna-m'ho a demanar."
                : "¡Ostras jefe! Google me ha cortado el grifo (error de cuota). Espérate un minuto y vuélvemelo a pedir.";
            }

            await whatsappService.sendWhatsAppMessage(senderPhone, failMsg);
        }
      } catch (logError) {
        console.error('Failed to send fallback error message:', logError);
      }
    }
  })();
});
