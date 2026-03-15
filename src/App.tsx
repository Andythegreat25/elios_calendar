import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CalendarPage } from './pages/CalendarPage';
import { Logo } from './components/Logo';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './hooks/useAuth';
import { Eye, EyeOff } from 'lucide-react';

// ─── Loading ──────────────────────────────────────────────────────────────────

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

// ─── Login ────────────────────────────────────────────────────────────────────

interface LoginScreenProps {
  onGoogleLogin: () => void;
  onEmailLogin: (email: string, password: string, remember: boolean) => Promise<void>;
  onEmailRegister: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

function LoginScreen({
  onGoogleLogin, onEmailLogin, onEmailRegister,
  isLoading, error, onClearError,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onClearError();
    setter(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await onEmailLogin(email, password, remember);
    } else {
      await onEmailRegister(email, password);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    onClearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-4">
      <div className="bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-100 max-w-sm w-full">

        {/* Logo + titolo */}
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-14 h-14 mb-5" />
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Elios Workspace
          </h1>
          <p className="text-zinc-400 mt-2 text-sm text-center leading-relaxed">
            {mode === 'login'
              ? 'Accedi per gestire gli appuntamenti del team.'
              : 'Crea un account per unirti al team.'}
          </p>
        </div>

        {/* Form email/password */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email aziendale"
            value={email}
            onChange={handleChange(setEmail)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={handleChange(setPassword)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-4 py-3 pr-11 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Ricordami (solo in modalità login) */}
          {mode === 'login' && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="appearance-none w-4 h-4 border border-zinc-300 rounded checked:bg-zinc-900 checked:border-zinc-900 transition-colors"
                />
                {remember && (
                  <svg className="w-2.5 h-2.5 text-white absolute pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-zinc-600">Ricordami</span>
            </label>
          )}

          {/* Errore */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-zinc-900 text-white rounded-xl py-3 px-4 font-medium hover:bg-zinc-800 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {isLoading ? (
              <Spinner size="sm" className="border-zinc-500 border-t-white" />
            ) : (
              mode === 'login' ? 'Accedi' : 'Crea account'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-zinc-100" />
          <span className="text-xs text-zinc-400 font-medium">oppure</span>
          <div className="flex-1 h-px bg-zinc-100" />
        </div>

        {/* Google */}
        <button
          onClick={onGoogleLogin}
          disabled={isLoading}
          className="w-full border border-zinc-200 text-zinc-700 rounded-xl py-3 px-4 font-medium hover:bg-zinc-50 transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continua con Google
        </button>

        {/* Toggle login / registrazione */}
        <p className="text-center text-sm text-zinc-400 mt-6">
          {mode === 'login' ? 'Non hai un account?' : 'Hai già un account?'}{' '}
          <button
            type="button"
            onClick={switchMode}
            className="text-zinc-700 font-medium hover:text-zinc-900 transition-colors underline underline-offset-2"
          >
            {mode === 'login' ? 'Registrati' : 'Accedi'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate() {
  const { user, isAuthReady, isLoggingIn, login, loginEmail, registerEmail, error, clearError } = useAuth();

  if (!isAuthReady) return <LoadingScreen />;
  if (!user) return (
    <LoginScreen
      onGoogleLogin={login}
      onEmailLogin={loginEmail}
      onEmailRegister={registerEmail}
      isLoading={isLoggingIn}
      error={error}
      onClearError={clearError}
    />
  );
  return <CalendarPage user={user} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  );
}
