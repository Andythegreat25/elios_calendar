import React, { useEffect, useState } from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

const WARNING_SECONDS = 60; // deve combaciare con WARNING_MS nel hook

interface Props {
  onStay:   () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({ onStay, onLogout }: Props) {
  const [seconds, setSeconds] = useState(WARNING_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const radius   = 22;
  const circ     = 2 * Math.PI * radius;
  const progress = (seconds / WARNING_SECONDS) * circ;

  // Colore del countdown: verde → giallo → rosso
  const color =
    seconds > 30 ? '#22c55e' :
    seconds > 10 ? '#f59e0b' :
                   '#ef4444';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800 max-w-sm w-full p-8 flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-200">

        {/* Icona */}
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-amber-500" />
        </div>

        {/* Testo */}
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Sessione in scadenza
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Sei rimasto inattivo per troppo tempo.
            <br />
            Verrai disconnesso automaticamente.
          </p>
        </div>

        {/* Countdown circolare */}
        <div className="relative flex items-center justify-center w-16 h-16">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 52 52" width="64" height="64">
            {/* Track */}
            <circle
              cx="26" cy="26" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-zinc-100 dark:text-zinc-800"
            />
            {/* Progress */}
            <circle
              cx="26" cy="26" r={radius}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ - progress}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
            />
          </svg>
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color }}
          >
            {seconds}
          </span>
        </div>

        {/* Pulsanti */}
        <div className="flex flex-col gap-2.5 w-full mt-1">
          <button
            onClick={onStay}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl py-3 px-4 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Rimani connesso
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 py-2.5 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Esci ora
          </button>
        </div>
      </div>
    </div>
  );
}
