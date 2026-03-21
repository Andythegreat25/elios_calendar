import { useEffect, useRef, useCallback } from 'react';

// 14 minuti di inattività → avviso
// 1 minuto di countdown → logout automatico
const INACTIVITY_MS  = 14 * 60 * 1000;
const WARNING_MS     =  1 * 60 * 1000;

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
] as const;

interface Options {
  isActive: boolean;        // true solo quando l'utente è loggato
  onWarn:   () => void;     // mostra il modal di avviso
  onLogout: () => void;     // esegue il logout automatico
}

export function useSessionTimeout({ isActive, onWarn, onLogout }: Options) {
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current)   clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    warnTimerRef.current   = null;
    logoutTimerRef.current = null;
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    if (!isActive) return;

    warnTimerRef.current = setTimeout(() => {
      onWarn();
      logoutTimerRef.current = setTimeout(() => {
        onLogout();
      }, WARNING_MS);
    }, INACTIVITY_MS);
  }, [isActive, onWarn, onLogout, clearTimers]);

  useEffect(() => {
    if (!isActive) {
      clearTimers();
      return;
    }

    const handleActivity = () => resetTimers();

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { passive: true })
    );
    resetTimers(); // avvia subito i timer al mount / login

    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handleActivity)
      );
      clearTimers();
    };
  }, [isActive, resetTimers, clearTimers]);

  return { resetTimers };
}
