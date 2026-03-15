import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina classi condizionali (clsx) e risolve conflitti Tailwind (twMerge).
 *
 * Uso:
 *   cn('px-4 py-2', isActive && 'bg-violet-500', 'px-6')
 *   // → "py-2 bg-violet-500 px-6"  (px-4 sovrascritto da px-6)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
