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
  onEmailLogin: (email: string, password: string, remember: boolean) => Promise<void>;
  onEmailRegister: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

function LoginScreen({
  onEmailLogin, onEmailRegister,
  isLoading, error, onClearError,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(() => localStorage.getItem('elios_last_email') ?? '');
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
      if (remember) localStorage.setItem('elios_last_email', email);
      else localStorage.removeItem('elios_last_email');
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
            id="email"
            name="email"
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
              id="password"
              name="password"
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
  const { user, isAuthReady, isLoggingIn, loginEmail, registerEmail, error, clearError } = useAuth();

  if (!isAuthReady) return <LoadingScreen />;
  if (!user) return (
    <LoginScreen
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
