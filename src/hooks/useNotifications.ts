import { useEffect, useRef, useCallback } from 'react';
import type { CalendarEvent } from '@/types';
import { isToday } from 'date-fns';

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
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      for (const event of events) {
        if (!isToday(event.date)) continue;

        const [h, m] = event.startTime.split(':').map(Number);
        const eventMinutes = h * 60 + m;
        const diff = eventMinutes - nowMinutes;

        // Notify 10 minutes before
        if (diff >= 0 && diff <= 10) {
          const key = `${event.id}_notif`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            try {
              new Notification(`📅 ${event.title}`, {
                body: diff === 0
                  ? `Sta iniziando ora · ${event.startTime}`
                  : `Inizia tra ${diff} minut${diff === 1 ? 'o' : 'i'} · ${event.startTime}`,
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
