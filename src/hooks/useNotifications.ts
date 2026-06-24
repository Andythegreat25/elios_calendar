import { useEffect } from 'react';
import { CalendarEvent } from '../types';
import { isSameDay, parse, differenceInMinutes, isBefore } from 'date-fns';

const LOCAL_STORAGE_KEY = 'notified_events_v1';

export function useNotifications(events: CalendarEvent[], userUid?: string) {
  useEffect(() => {
    if (!('Notification' in window)) return;
    
    // Request permission if not already granted or denied
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Only proceed if user is logged in and notifications are granted
    if (!userUid || !('Notification' in window) || Notification.permission !== 'granted') return;

    const checkNotifications = () => {
      const now = new Date();
      
      const storedNotified = localStorage.getItem(LOCAL_STORAGE_KEY);
      const notifiedSet = new Set<string>(storedNotified ? JSON.parse(storedNotified) : []);
      let updated = false;

      events.forEach(event => {
        // Only notify for user's own events
        if (event.ownerId !== userUid) return;
        
        // Only check today's events
        if (!isSameDay(event.date, now)) return;
        
        // Skip if already notified
        if (notifiedSet.has(event.id)) return;

        const startTime = parse(event.startTime, 'HH:mm', event.date);
        
        // Skip if event already started
        if (isBefore(startTime, now)) return;

        const minutesUntilEvent = differenceInMinutes(startTime, now);

        // Notify if 15 minutes or less until the event
        if (minutesUntilEvent <= 15 && minutesUntilEvent >= 0) {
          try {
            new Notification(`Promemoria: ${event.title}`, {
              body: `Il tuo appuntamento inizia alle ${event.startTime}${event.description ? `\n${event.description}` : ''}`,
            });
            notifiedSet.add(event.id);
            updated = true;
          } catch (error) {
            console.error('Error showing notification:', error);
          }
        }
      });

      if (updated) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(notifiedSet)));
      }
    };

    // Check immediately
    checkNotifications();
    
    // Then check every minute
    const intervalId = setInterval(checkNotifications, 60000);

    return () => clearInterval(intervalId);
  }, [events, userUid]);
}
