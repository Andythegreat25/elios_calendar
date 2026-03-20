import { useEffect, useRef, useCallback } from 'react';
import type { CalendarEvent } from '@/types';

/**
 * Gestisce le notifiche browser per gli eventi imminenti.
 * - Richiede il permesso al primo mount
 * - Controlla ogni minuto gli eventi dei prossimi 10 minuti
 * - Evita notifiche duplicate con un Set per sessione
 */
export function useNotifications(events: CalendarEvent[]) {
  const notifiedRef = useRef<Set<string>>(new Set());

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (!('Notification' in window)) return;

    const checkUpcoming = () => {
      if (Notification.permission !== 'granted') return;

      const now = new Date();

      for (const event of events) {
        // Costruisce il datetime esatto dell'evento combinando data + ora
        const eventDt = new Date(event.date);
        const [h, m] = event.startTime.split(':').map(Number);
        eventDt.setHours(h, m, 0, 0);

        const diffMin = Math.round((eventDt.getTime() - now.getTime()) / 60_000);

        // Notifica se l'evento inizia nei prossimi 10 minuti (gestisce mezzanotte correttamente)
        if (diffMin >= 0 && diffMin <= 10) {
          const key = `${event.id}_notif`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            try {
              new Notification(`📅 ${event.title}`, {
                body: diffMin === 0
                  ? `Sta iniziando ora · ${event.startTime}`
                  : `Inizia tra ${diffMin} minut${diffMin === 1 ? 'o' : 'i'} · ${event.startTime}`,
                icon: '/favicon.svg',
                tag: key,
              });
            } catch {
              // Ignore notification errors (e.g. unsupported browser)
            }
          }
        }
      }
    };

    checkUpcoming();
    const interval = setInterval(checkUpcoming, 60_000);
    return () => clearInterval(interval);
  }, [events]);
}
