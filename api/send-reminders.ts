/**
 * Vercel Cron Function — Email reminders per eventi imminenti.
 *
 * Esecuzione configurata in vercel.json (es. ogni 15 minuti su Piano Pro).
 * Per ogni evento che inizia tra WINDOW_MINUTES_MIN e WINDOW_MINUTES_MAX minuti,
 * invia un email reminder al proprietario via Resend API.
 *
 * Variabili d'ambiente necessarie:
 *   CRON_SECRET            — token segreto per proteggere l'endpoint
 *   SUPABASE_URL           — URL del progetto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — chiave service role (non la anon key)
 *   RESEND_API_KEY         — API key di Resend (https://resend.com)
 *   RESEND_FROM            — mittente, es. "Elios Calendar <noreply@elios.app>"
 */

export const config = { runtime: 'edge' };

const WINDOW_MINUTES_MIN = 10;
const WINDOW_MINUTES_MAX = 25;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function emailHtml(title: string, startTime: string, description?: string | null): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Promemoria evento</title>
</head>
<body style="margin:0;padding:0;background:#0f0f11;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:0 16px;">
    <div style="background:#1C1C1E;border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.08);">
      <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:32px;">
        <div style="width:10px;height:10px;border-radius:50%;background:#A881F3;"></div>
        <span style="color:#A1A1AA;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Elios Calendar</span>
      </div>
      <h1 style="color:#fff;font-size:20px;font-weight:600;margin:0 0 8px;">${title}</h1>
      <p style="color:#71717A;font-size:14px;margin:0 0 24px;">Inizia alle <strong style="color:#A881F3;">${startTime}</strong></p>
      ${description ? `<p style="color:#A1A1AA;font-size:13px;background:rgba(255,255,255,0.05);border-radius:12px;padding:14px 16px;margin:0;">${description}</p>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:28px 0;" />
      <p style="color:#52525B;font-size:11px;margin:0;">Hai ricevuto questo reminder perché sei il proprietario dell'evento.</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: Request): Promise<Response> {
  // Verifica il CRON_SECRET (Vercel lo imposta via Authorization header)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM ?? 'Elios Calendar <noreply@elios.app>';

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured', { status: 500 });
  }
  if (!resendApiKey) {
    return new Response('RESEND_API_KEY not configured', { status: 500 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_MINUTES_MIN * 60_000);
  const windowEnd = new Date(now.getTime() + WINDOW_MINUTES_MAX * 60_000);

  const todayStr = formatDate(now);
  const timeMin = formatTime(windowStart);
  const timeMax = formatTime(windowEnd);

  // Query eventi nel finestra temporale
  const eventsRes = await fetch(
    `${supabaseUrl}/rest/v1/events?select=id,title,date,start_time,end_time,description,owner_id&date=eq.${todayStr}&start_time=gte.${timeMin}&start_time=lte.${timeMax}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!eventsRes.ok) {
    return new Response(`Supabase query failed: ${eventsRes.status}`, { status: 502 });
  }

  const events: { id: string; title: string; date: string; start_time: string; end_time: string; description?: string; owner_id: string }[] = await eventsRes.json();

  if (!events.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'Nessun evento nel range' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Ottieni email degli owner via Supabase Admin API
  const ownerIds = [...new Set(events.map((e) => e.owner_id))];
  const emailMap = new Map<string, string>();

  for (const uid of ownerIds) {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${uid}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (userRes.ok) {
      const user: { email?: string } = await userRes.json();
      if (user.email) emailMap.set(uid, user.email);
    }
  }

  // Invia email
  let sent = 0;
  const errors: string[] = [];

  for (const event of events) {
    const toEmail = emailMap.get(event.owner_id);
    if (!toEmail) continue;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [toEmail],
        subject: `⏰ Promemoria: "${event.title}" inizia tra poco`,
        html: emailHtml(event.title, event.start_time, event.description),
      }),
    });

    if (resendRes.ok) {
      sent++;
    } else {
      const err = await resendRes.text();
      errors.push(`${event.id}: ${err}`);
    }
  }

  return new Response(JSON.stringify({ sent, errors: errors.length ? errors : undefined }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
