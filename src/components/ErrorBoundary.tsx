import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full">
        <h2 className="text-xl font-semibold text-red-600 mb-4">Si è verificato un errore</h2>
        <div className="bg-red-50 p-4 rounded-lg overflow-auto max-h-64">
          <pre className="text-sm text-red-900 whitespace-pre-wrap">
            {error.message}
          </pre>
        </div>
        <button
          onClick={resetErrorBoundary}
          className="mt-6 w-full px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
        >
          Ricarica l'applicazione
        </button>
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  );
}
