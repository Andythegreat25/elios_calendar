import { cn } from '@/utils/cn';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
};

/**
 * Spinner di caricamento.
 * Usato nei bottoni (size="sm") e nelle schermate di loading (size="lg").
 */
export function Spinner({ className, size = 'md' }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Caricamento in corso"
      className={cn(
        'rounded-full border-zinc-200 border-t-zinc-600 animate-spin',
        sizeMap[size],
        className,
      )}
    />
  );
}
