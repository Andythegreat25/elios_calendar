import { useEffect } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export type ToastVariant = 'error' | 'success';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
  /** Auto-dismiss dopo N ms. Default: 5000. Passa 0 per disabilitare. */
  duration?: number;
}

/**
 * Notifica toast non-bloccante.
 * Si auto-chiude dopo `duration` ms (default 5s).
 * Posizionato in basso-destra via fixed positioning.
 *
 * Uso nel parent:
 *   const [toast, setToast] = useState<string | null>(null);
 *   <Toast message={toast} onDismiss={() => setToast(null)} />
 */
export function Toast({ message, variant = 'error', onDismiss, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  const isError = variant === 'error';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'fixed bottom-6 right-6 z-[100] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-xl',
        'max-w-sm w-full animate-in slide-in-from-bottom-4 fade-in duration-300',
        isError
          ? 'bg-red-50 border border-red-200 text-red-800'
          : 'bg-emerald-50 border border-emerald-200 text-emerald-800',
      )}
    >
      {isError ? (
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
      )}
      <p className="text-sm font-medium flex-1 leading-snug">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Chiudi notifica"
        className={cn(
          'p-1 rounded-full transition-colors flex-shrink-0',
          isError ? 'hover:bg-red-100 text-red-400' : 'hover:bg-emerald-100 text-emerald-400',
        )}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
