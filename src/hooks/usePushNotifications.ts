import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Gestisce la sottoscrizione Web Push per le notifiche reminder.
 *
 * Prerequisiti:
 *  - Service Worker registrato (public/sw.js)
 *  - VITE_VAPID_PUBLIC_KEY impostata nelle env vars
 *  - Tabella Supabase `push_subscriptions` con RLS per utente
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  toggle: (userId: string) => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Verifica supporto e stato iniziale al mount
  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      !!import.meta.env.VITE_VAPID_PUBLIC_KEY;
    setIsSupported(supported);

    if (!supported) {
      setIsLoading(false);
      return;
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => setIsSubscribed(false))
      .finally(() => setIsLoading(false));
  }, []);

  const toggle = useCallback(async (userId: string) => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      if (existing) {
        // ── Disabilita ────────────────────────────────────────────────────────
        await existing.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', existing.endpoint);
        setIsSubscribed(false);
      } else {
        // ── Abilita ───────────────────────────────────────────────────────────
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const subJson = sub.toJSON();
        await supabase.from('push_subscriptions').upsert(
          {
            user_id:      userId,
            endpoint:     sub.endpoint,
            subscription: subJson,
          },
          { onConflict: 'user_id, endpoint' },
        );
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error('[usePushNotifications] toggle error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, isLoading, toggle };
}
