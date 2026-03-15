import { ErrorBoundary } from './components/ErrorBoundary';
import { CalendarPage } from './pages/CalendarPage';
import { Logo } from './components/Logo';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './hooks/useAuth';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="flex flex-col items-center gap-6">
        <Logo className="w-12 h-12" />
        <Spinner size="md" />
      </div>
    </div>
  );
}

interface LoginScreenProps {
  onLogin: () => void;
  isLoading: boolean;
}

function LoginScreen({ onLogin, isLoading }: LoginScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-4">
      <div className="bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100 max-w-sm w-full text-center">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-8">
          <Logo className="w-16 h-16" />
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-3 tracking-tight">
          Elios Workspace
        </h1>
        <p className="text-zinc-500 mb-10 text-sm leading-relaxed">
          Accedi per visualizzare e gestire gli appuntamenti e le risorse del team.
        </p>
        <button
          onClick={onLogin}
          disabled={isLoading}
          className="w-full bg-zinc-900 text-white rounded-xl py-3.5 px-4 font-medium hover:bg-zinc-800 transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Spinner size="sm" className="border-zinc-500 border-t-white" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          {isLoading ? 'Accesso in corso...' : 'Continua con Google'}
        </button>
      </div>
    </div>
  );
}

function AuthGate() {
  const { user, isAuthReady, isLoggingIn, login } = useAuth();

  if (!isAuthReady) return <LoadingScreen />;
  if (!user)        return <LoginScreen onLogin={login} isLoading={isLoggingIn} />;
  return <CalendarPage user={user} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  );
}
