import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ─── Service Worker + auto-aggiornamento ──────────────────────────────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => {
        // Quando il SW controller cambia (nuovo SW attivato), ricarica la pagina.
        // La variabile `refreshing` previene loop infiniti.
        // `hadController` evita il reload al primo install (nessun SW precedente).
        const hadController = !!navigator.serviceWorker.controller;
        let refreshing = false;

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hadController && !refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });

        // Ascolta anche il messaggio esplicito dal SW (doppio meccanismo di sicurezza)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SW_UPDATED' && !refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      })
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}
