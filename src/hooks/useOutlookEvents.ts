/**
 * Hook che legge i feed ICS di tutti i profili colleghi e restituisce
 * gli eventi come ExternalEvent[].
 *
 * Flusso:
 * 1. Filtra i profili che hanno icsUrl configurato
 * 2. Per ogni profilo, fetcha via /api/ics-proxy (Edge Function su Vercel)
 * 3. Parsa il testo ICS con parseIcs()
 * 4. Aggrega tutti gli eventi in un unico array
 * 5. Refresha ogni 5 minuti automaticamente
 *
 * Il cambio di icsUrl in qualsiasi profilo ri-triggera il fetch.
 * Usa Promise.allSettled per tollerare feed non raggiungibili singolarmente.
 */

import { useEffect, useState } from 'react';
import type { Profile } from '@/types';
import { parseIcs, type ExternalEvent } from '@/utils/icsParser';

const PROXY_BASE = '/api/ics-proxy';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minuti

export function useOutlookEvents(profiles: Profile[]): ExternalEvent[] {
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);

  // Chiave stabile basata sugli icsUrl presenti — evita re-fetch su ogni
  // Firestore snapshot se gli URL non sono cambiati.
  const icsSignature = profiles
    .map((p) => `${p.uid}:${p.icsUrl ?? ''}`)
    .sort()
    .join('|');

  useEffect(() => {
    const profilesWithIcs = profiles.filter((p) => p.icsUrl);

    if (profilesWithIcs.length === 0) {
      setExternalEvents([]);
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      const results = await Promise.allSettled(
        profilesWithIcs.map(async (profile) => {
          const proxyUrl = `${PROXY_BASE}?url=${encodeURIComponent(profile.icsUrl!)}`;
          const res = await fetch(proxyUrl);
          if (!res.ok) {
            throw new Error(`ICS fetch failed for ${profile.displayName}: ${res.status}`);
          }
          const text = await res.text();
          return parseIcs(text, profile.uid, profile.displayName);
        }),
      );

      if (cancelled) return;

      const all: ExternalEvent[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          all.push(...result.value);
        } else {
          // Feed non raggiungibile — silenzioso in produzione
          console.warn('[useOutlookEvents]', result.reason);
        }
      }
      setExternalEvents(all);
    };

    fetchAll();
    const interval = setInterval(fetchAll, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icsSignature]);

  return externalEvents;
}
