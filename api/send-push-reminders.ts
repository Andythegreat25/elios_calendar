/**
 * Vercel Function (Node.js runtime) — Push reminder per eventi imminenti.
 *
 * Chiamato da cron-job.org ogni 5 minuti (o da Vercel Cron se configurato).
 * Per ogni utente con una push subscription attiva e `reminder_minutes` impostato,
 * invia una notifica push per gli eventi che iniziano tra
 * (reminderMinutes - 2.5) e (reminderMinutes + 2.5) minuti.
 *
 * Variabili d'ambiente necessarie:
 *   CRON_SECRET               — token Bearer per proteggere l'endpoint
 *   SUPABASE_URL              — URL del progetto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — chiave service role
 *   VAPID_PUBLIC_KEY          — chiave pubblica VAPID
 *   VAPID_PRIVATE_KEY         — chiave privata VAPID
 *   VAPID_SUBJECT             — mailto: o URL del mittente
 */

import webpush from 'web-push';

export const config = { runtime: 'nodejs' };

const HALF_WINDOW_MS = 2.5 * 60_000; // ±2.5 minuti attorno al reminder

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

type PushSubscriptionRow = {
  user_id:      string;
  endpoint:     string;
  subscription: webpush.PushSubscription;
};

type ProfileRow = {
  uid:              string;
  reminder_minutes: number | null;
};

type EventRow = {
  id:          string;
  title:       string;
  start_time:  string;
  description: string | null;
  owner_id:    string;
};

export default async function handler(req: Request): Promise<Response> {
  // Auth
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl      = process.env.SUPABASE_URL;
  const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey   = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey  = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject     = process.env.VAPID_SUBJECT ?? 'mailto:noreply@eliosapp.it';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti', { status: 500 });
  }
  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY mancanti', { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const headers = {
    apikey:        serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  // 1. Carica tutte le push subscriptions attive
  const subsRes = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?select=user_id,endpoint,subscription`,
    { headers },
  );
  if (!subsRes.ok) {
    return new Response(`Supabase push_subscriptions query fallita: ${subsRes.status}`, { status: 502 });
  }
  const subscriptions: PushSubscriptionRow[] = await subsRes.json();
  if (!subscriptions.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'Nessuna subscription attiva' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Carica profili degli utenti con subscription (reminder_minutes)
  const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
  const profilesRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=uid,reminder_minutes&uid=in.(${userIds.join(',')})`,
    { headers },
  );
  if (!profilesRes.ok) {
    return new Response(`Supabase profiles query fallita: ${profilesRes.status}`, { status: 502 });
  }
  const profiles: ProfileRow[] = await profilesRes.json();

  // Mappa userId → reminderMinutes (solo utenti con reminder attivo)
  const reminderMap = new Map<string, number>();
  for (const p of profiles) {
    if (p.reminder_minutes != null && p.reminder_minutes > 0) {
      reminderMap.set(p.uid, p.reminder_minutes);
    }
  }

  if (!reminderMap.size) {
    return new Response(JSON.stringify({ sent: 0, message: 'Nessun utente con reminder attivo' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now     = new Date();
  const todayStr = formatDate(now);
  let sent   = 0;
  const errors: string[] = [];

  // 3. Per ogni utente con reminder, cerca eventi imminenti
  for (const [userId, reminderMinutes] of reminderMap) {
    const targetTime   = new Date(now.getTime() + reminderMinutes * 60_000);
    const windowStart  = new Date(targetTime.getTime() - HALF_WINDOW_MS);
    const windowEnd    = new Date(targetTime.getTime() + HALF_WINDOW_MS);

    const timeMin = formatTime(windowStart);
    const timeMax = formatTime(windowEnd);

    const eventsRes = await fetch(
      `${supabaseUrl}/rest/v1/events?select=id,title,start_time,description,owner_id&date=eq.${todayStr}&start_time=gte.${timeMin}&start_time=lte.${timeMax}&owner_id=eq.${userId}`,
      { headers },
    );
    if (!eventsRes.ok) continue;

    const events: EventRow[] = await eventsRes.json();
    if (!events.length) continue;

    // Subscriptions di questo utente
    const userSubs = subscriptions.filter((s) => s.user_id === userId);

    for (const event of events) {
      for (const sub of userSubs) {
        const payload = JSON.stringify({
          title: `📅 ${event.title}`,
          body:  `Inizia tra ${reminderMinutes} minut${reminderMinutes === 1 ? 'o' : 'i'} · ${event.start_time}`,
          tag:   `elios-${event.id}`,
        });

        try {
          await webpush.sendNotification(sub.subscription, payload);
          sent++;
        } catch (err: unknown) {
          // 410 Gone = subscription scaduta → rimuoviamo dal DB
          if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
            await fetch(
              `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
              { method: 'DELETE', headers },
            );
          } else {
            errors.push(`${event.id}/${sub.endpoint.slice(-20)}: ${String(err)}`);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, errors: errors.length ? errors : undefined }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
