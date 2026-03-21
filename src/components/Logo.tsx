import React from 'react';

interface LogoProps {
  className?: string;
  /** 'dark' = petali navy su sfondo chiaro (default) | 'light' = petali bianchi su sfondo scuro */
  variant?: 'dark' | 'light';
}

export function Logo({ className = 'w-8 h-8', variant = 'dark' }: LogoProps) {
  const petalColor = variant === 'light' ? '#FFFFFF' : '#0A1931';

  return (
    <svg viewBox="0 0 100 100" className={className}>
      <g fill={petalColor}>
        {[...Array(16)].map((_, i) => (
          <path
            key={i}
            d="M 46 37 Q 50 33 54 37 Q 58 20 50 2 Q 42 20 46 37"
            transform={`rotate(${i * 22.5} 50 50)`}
          />
        ))}
      </g>
      <circle cx="50" cy="50" r="11" fill="#C8C819" />
    </svg>
  );
}

/** Logo completo: icona + wordmark "ELIOS / AMBIENTE" — per splash screen e header ampi */
export function LogoFull({
  className,
  variant = 'dark',
}: {
  className?: string;
  variant?: 'dark' | 'light';
}) {
  const textColor  = variant === 'light' ? '#FFFFFF' : '#0A1931';
  const petalColor = variant === 'light' ? '#FFFFFF' : '#0A1931';

  return (
    <div className={`flex items-center gap-4 ${className ?? ''}`}>
      {/* Icona fiore */}
      <svg viewBox="0 0 100 100" className="w-14 h-14 shrink-0">
        <g fill={petalColor}>
          {[...Array(16)].map((_, i) => (
            <path
              key={i}
              d="M 46 37 Q 50 33 54 37 Q 58 20 50 2 Q 42 20 46 37"
              transform={`rotate(${i * 22.5} 50 50)`}
            />
          ))}
        </g>
        <circle cx="50" cy="50" r="11" fill="#C8C819" />
      </svg>

      {/* Wordmark */}
      <div className="flex flex-col leading-none" style={{ fontFamily: 'Inter, sans-serif' }}>
        <span
          className="font-bold tracking-widest uppercase"
          style={{ fontSize: 28, color: textColor, letterSpacing: '0.18em' }}
        >
          ELIOS
        </span>
        <span
          className="font-light tracking-widest uppercase"
          style={{ fontSize: 14, color: textColor, opacity: 0.85, letterSpacing: '0.32em', marginTop: 2 }}
        >
          AMBIENTE
        </span>
      </div>
    </div>
  );
}
