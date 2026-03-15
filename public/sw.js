/**
 * Service Worker — Elios Calendar
 *
 * Strategia:
 * - Install: pre-cacha la shell statica (HTML, favicon)
 * - Fetch: cache-first per asset statici (.js, .css, .svg, .png)
 *          network-first (bypass) per Firebase, ICS proxy e qualsiasi altra API
 *
 * Aggiornamento: quando si deploya una nuova versione, cambia CACHE_NAME
 * (es. "elios-v2") → il vecchio cache viene eliminato all'activate.
 */

const CACHE_NAME = 'elios-v1';

const PRECACHE = [
  '/',
  '/favicon.svg',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)),
  );
  // Attiva subito senza aspettare che le vecchie schede vengano chiuse
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  // Prende il controllo di tutte le schede aperte immediatamente
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Lascia passare senza cache:
  // - Richieste non-GET (POST, PUT, DELETE verso Firestore)
  // - Firebase / Firestore / Google APIs
  // - ICS proxy Vercel
  // - Qualsiasi richiesta cross-origin verso servizi esterni
  const isExternalService =
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('outlook.') ||
    url.hostname.includes('calendar.google.com');

  if (request.method !== 'GET' || isExternalService) {
    return; // browser gestisce normalmente
  }

  // Cache-first per asset statici (.js, .css, .png, .svg, .woff2, ecc.)
  // Network-first per HTML (così si ottiene sempre l'ultima versione dell'app shell)
  const isHTMLNavigation =
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html');

  if (isHTMLNavigation) {
    // Network-first → fallback su cache per offline
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

  // Cache-first per tutto il resto (JS/CSS/immagini Vite)
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
