import React from 'react';

export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <g fill="#0A1931">
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
