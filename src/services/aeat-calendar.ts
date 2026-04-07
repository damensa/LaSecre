import * as nodeIcal from 'node-ical';
import prisma from '../utils/prisma';

// URLs públiques dels calendaris .ics de l'AEAT
const AEAT_CALENDARS = [
  {
    url: 'https://www.google.com/calendar/ical/invitado2aeat%40gmail.com/public/basic.ics',
    category: 'RENDA',
  },
  {
    url: 'https://www.google.com/calendar/ical/517mcuhcis0lldnp9b7c0nk2q8%40group.calendar.google.com/public/basic.ics',
    category: 'IVA',
  },
  {
    url: 'https://www.google.com/calendar/ical/hqp9h5ft4snag42aea96791g28%40group.calendar.google.com/public/basic.ics',
    category: 'INFORMATIVA',
  },
];

/**
 * Descarrega i sincronitza els calendaris AEAT a la BD.
 * S'executa cada setmana via cron.
 */
export async function syncAeatCalendars(): Promise<void> {
  console.log('[AEAT] Starting calendar sync...');

  for (const cal of AEAT_CALENDARS) {
    try {
      const events = await nodeIcal.async.fromURL(cal.url);

      for (const key of Object.keys(events)) {
        const event = events[key] as any;
        if (event.type !== 'VEVENT') continue;

        const uid = event.uid?.toString();
        const title = event.summary?.toString() || 'Venciment fiscal';
        const description = event.description?.toString() || null;
        const dueDate = event.start instanceof Date ? event.start : null;

        if (!uid || !dueDate) continue;

        // Ignorar events passats (fa més de 7 dies)
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        if (dueDate < cutoff) continue;

        await (prisma as any).aeatEvent.upsert({
          where: { uid },
          update: { title, description, dueDate, category: cal.category },
          create: { uid, title, description, dueDate, category: cal.category },
        });
      }

      console.log(`[AEAT] Synced category: ${cal.category}`);
    } catch (err: any) {
      console.error(`[AEAT] Error syncing ${cal.category}:`, err.message);
    }
  }

  console.log('[AEAT] Calendar sync complete.');
}

/**
 * Retorna els events que vencen en exactament N dies des d'avui.
 */
export async function getEventsInNDays(days: number): Promise<any[]> {
  const now = new Date();
  const target = new Date();
  target.setDate(now.getDate() + days);

  // Rang de tot el dia objectiu (00:00 - 23:59)
  const startOfDay = new Date(target);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(target);
  endOfDay.setHours(23, 59, 59, 999);

  return (prisma as any).aeatEvent.findMany({
    where: {
      dueDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
}

/**
 * Envia recordatoris WhatsApp als usuaris actius per als events propers.
 * S'executa cada dia a les 9:00h via cron.
 */
export async function sendAeatReminders(
  sendMessageFn: (phone: string, msg: string) => Promise<any>
): Promise<void> {
  const reminderDays = [7, 2];

  for (const days of reminderDays) {
    const events = await getEventsInNDays(days);
    if (events.length === 0) continue;

    // Obtenir tots els usuaris actius que volen recordatoris
    const users = await (prisma as any).user.findMany({
      where: { aeatReminders: true },
    });

    for (const event of events) {
      const dueDateStr = new Date(event.dueDate).toLocaleDateString('ca-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      for (const user of users) {
        // Verificar si ja hem enviat aquest recordatori
        const alreadySent = await (prisma as any).aeatReminder.findUnique({
          where: {
            userPhone_aeatEventId_daysBeforeDeadline: {
              userPhone: user.phone,
              aeatEventId: event.id,
              daysBeforeDeadline: days,
            },
          },
        });

        if (alreadySent) continue;

        // Determinar idioma (CA/ES) basant-se en l'historial recent
        const recentMessages = await (prisma as any).message.findMany({
          where: { userPhone: user.phone },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        const historyText = recentMessages.map((m: any) => m.content).join(' ');
        const isCatalan = /[l|d]'|'m |ny|l·l|\b(el|la|meu|resum|vull|puc)\b/i.test(historyText);

        let message = '';

        if (days === 7) {
          message = isCatalan
            ? `⚠️ *Recordatori fiscal:* El *${event.title}* venc d'aquí 7 dies (${dueDateStr}).\nNo se t'oblidi presentar-ho a temps o tindràs recàrrec.\n_Per desactivar aquests recordatoris escriu: "sense recordatoris"_`
            : `⚠️ *Recordatorio fiscal:* El *${event.title}* vence en 7 días (${dueDateStr}).\nNo olvides presentarlo a tiempo o tendrás recargo.\n_Para desactivar estos recordatorios escribe: "sin recordatorios"_`;
        } else if (days === 2) {
          message = isCatalan
            ? `🚨 *URGENT:* El *${event.title}* venc d'aquí 2 dies (${dueDateStr}).\nEts a temps, però no t'atunis!`
            : `🚨 *URGENTE:* El *${event.title}* vence en 2 días (${dueDateStr}).\n¡Todavía estás a tiempo, pero no te despistes!`;
        }

        try {
          await sendMessageFn(user.phone, message);

          // Registrar l'enviament per evitar duplicats
          await (prisma as any).aeatReminder.create({
            data: {
              userPhone: user.phone,
              aeatEventId: event.id,
              daysBeforeDeadline: days,
            },
          });

          console.log(`[AEAT] Reminder sent to ${user.phone} for "${event.title}" (${days}d)`);
        } catch (err: any) {
          console.error(`[AEAT] Error sending reminder to ${user.phone}:`, err.message);
        }
      }
    }
  }
}
