/**
 * Service Worker — Elios Calendar
 *
 * Strategia:
 * - Install: pre-cacha la shell statica (HTML, favicon)
 * - Fetch: network-first per HTML (sempre la versione più recente)
 *          cache-first per asset statici (.js, .css — Vite usa content hash)
 *          bypass totale per Supabase, ICS proxy e servizi esterni
 *
 * Aggiornamento automatico:
 * skipWaiting() + clients.claim() attivano immediatamente il nuovo SW.
 * Il SW manda un messaggio SW_UPDATED ai client aperti, che eseguono
 * window.location.reload() ricevendo subito la nuova versione.
 */

const CACHE_NAME = 'elios-v3';

const PRECACHE = [
  '/',
  '/favicon.svg',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)),
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim())
      .then(() =>
        // Notifica tutte le schede aperte: è disponibile una nuova versione
        self.clients.matchAll({ type: 'window' }).then((clients) =>
          clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED' })),
        ),
      ),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass: non-GET e servizi esterni (Supabase, ICS, ecc.)
  const isExternal =
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('outlook.') ||
    url.hostname.includes('calendar.google.com') ||
    // Vercel API routes (ICS proxy)
    url.pathname.startsWith('/api/');

  if (request.method !== 'GET' || isExternal) {
    return;
  }

  // Network-first per navigazione HTML
  const isHTML =
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match('/'))),
    );
    return;
  }

  // Cache-first per asset statici (Vite content hash → filename cambia ad ogni build)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});
