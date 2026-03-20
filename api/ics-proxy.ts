/**
 * Vercel Edge Function — proxy CORS per feed ICS Outlook/Google.
 *
 * Problema: i server Outlook non inviano header CORS, quindi il browser
 * non può fare fetch() direttamente verso outlook.office.com.
 * Questa Edge Function fa da intermediario: il browser chiama /api/ics-proxy?url=...
 * e qui eseguiamo il fetch server-side, aggiungendo i header CORS nella risposta.
 *
 * Sicurezza: allowlist dei domini accettati per evitare che il proxy
 * venga usato come relay generico.
 *
 * Runtime: Vercel Edge (V8 isolate) — cold start <1ms, fetch nativo.
 */

export const config = { runtime: 'edge' };

/** Domini accettati come sorgente ICS. */
const ALLOWED_HOSTS = [
  'outlook.live.com',
  'outlook.office.com',
  'outlook.office365.com',
  'calendar.google.com',
  'calendar.yahoo.com',
];

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === 'https:' &&
      ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
    );
  } catch {
    return false;
  }
}

export default async function handler(request: Request): Promise<Response> {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const { searchParams } = new URL(request.url);
  const icsUrl = searchParams.get('url');

  if (!icsUrl) {
    return new Response('Missing "url" query param', { status: 400 });
  }

  if (!isAllowedUrl(icsUrl)) {
    return new Response(
      'URL not allowed. Accepted: outlook.office.com, outlook.live.com, calendar.google.com',
      { status: 403 },
    );
  }

  /** Dimensione massima accettata per un feed ICS (5 MB). */
  const MAX_ICS_BYTES = 5 * 1024 * 1024;

  try {
    const upstream = await fetch(icsUrl, {
      headers: {
        // Alcuni server Outlook richiedono un User-Agent non-browser
        'User-Agent': 'EliosCalendar/1.0 (+https://elios.vercel.app)',
        Accept: 'text/calendar, */*',
      },
      // Timeout 10s via AbortSignal (non tutti gli edge runtime lo supportano,
      // ma è un best-effort)
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status} ${upstream.statusText}`, {
        status: 502,
      });
    }

    // Controllo veloce su Content-Length (se presente)
    const contentLength = upstream.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > MAX_ICS_BYTES) {
      return new Response('ICS file too large (max 5 MB)', { status: 413 });
    }

    // Lettura in streaming con contatore di byte per gestire anche le risposte
    // senza Content-Length (chunked transfer / server che non dichiarano la size).
    // Senza questo limite, un server upstream potrebbe restituire un file enorme
    // esaurendo la memoria dell'Edge Function.
    const reader = upstream.body?.getReader();
    if (!reader) {
      return new Response('Empty response from upstream', { status: 502 });
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_ICS_BYTES) {
        await reader.cancel();
        return new Response('ICS file too large (max 5 MB)', { status: 413 });
      }
      chunks.push(value);
    }

    // Assembla il body da tutti i chunk
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = new TextDecoder('utf-8').decode(merged);

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // cache 5 minuti
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(`Fetch failed: ${message}`, { status: 502 });
  }
}
