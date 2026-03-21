import React, { useState, useCallback } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CalendarPage } from './pages/CalendarPage';
import { Logo, LogoFull } from './components/Logo';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './hooks/useAuth';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { SessionTimeoutModal } from './components/SessionTimeoutModal';
import { Eye, EyeOff } from 'lucide-react';

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingScreen({ isReady }: { isReady: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#0f0f11',
        backgroundImage: `
          radial-gradient(circle at 0% 20%,   rgba(168,129,243,0.25), transparent 35%),
          radial-gradient(circle at 100% 80%,  rgba(45,212,191,0.2),  transparent 35%),
          radial-gradient(circle at 50% 100%,  rgba(244,114,182,0.2), transparent 35%)
        `,
        transition: 'opacity 0.4s ease',
        opacity: isReady ? 0 : 1,
        pointerEvents: isReady ? 'none' : 'all',
      }}
    >
      {/* Cerchi decorativi blurrati */}
      <div className="absolute w-64 h-64 rounded-full pointer-events-none"
           style={{ background: 'rgba(168,129,243,0.08)', filter: 'blur(60px)', top: '20%', left: '15%' }} />
      <div className="absolute w-48 h-48 rounded-full pointer-events-none"
           style={{ background: 'rgba(45,212,191,0.08)', filter: 'blur(50px)', bottom: '20%', right: '15%' }} />

      {/* Logo completo con animazione */}
      <div className="splash-logo-reveal mb-3">
        <div className="splash-logo-spin">
          <LogoFull variant="light" />
        </div>
      </div>

      {/* Tagline */}
      <p className="splash-tagline text-sm mb-10 mt-4"
         style={{ color: 'rgba(255,255,255,0.38)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em' }}>
        Calendario enterprise del team
      </p>

      {/* Progress bar */}
      <div className="splash-bar-wrap overflow-hidden rounded-full"
           style={{ width: 220, height: 3, background: 'rgba(255,255,255,0.08)' }}>
        <div className="splash-bar-fill h-full rounded-full"
             style={{ background: 'linear-gradient(90deg, #a881f3, #2dd4bf)' }} />
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

interface LoginScreenProps {
  onEmailLogin: (email: string, password: string, remember: boolean) => Promise<void>;
  onEmailRegister: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

function LoginScreen({
  onEmailLogin, onEmailRegister, onResetPassword,
  isLoading, error, onClearError,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState(() => localStorage.getItem('elios_last_email') ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onClearError();
    setter(e.target.value);
  };

  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      if (remember) localStorage.setItem('elios_last_email', email);
      else localStorage.removeItem('elios_last_email');
      await onEmailLogin(email, password, remember);
    } else if (mode === 'register') {
      await onEmailRegister(email, password);
    } else {
      await onResetPassword(email);
      if (!error) setResetSent(true);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setResetSent(false);
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
            {mode === 'login' && 'Accedi per gestire gli appuntamenti del team.'}
            {mode === 'register' && 'Crea un account per unirti al team.'}
            {mode === 'forgot' && 'Inserisci la tua email per ricevere il link di reset.'}
          </p>
        </div>

        {/* Form email/password */}
        {resetSent && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium mb-4">
            Email inviata! Controlla la casella e clicca il link per reimpostare la password.
          </div>
        )}
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

          {mode !== 'forgot' && (
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
          )}

          {/* Link "Password dimenticata?" visibile solo nel login */}
          {mode === 'login' && (
            <div className="text-right -mt-1">
              <button
                type="button"
                onClick={() => { setMode('forgot'); setResetSent(false); onClearError(); }}
                className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                Password dimenticata?
              </button>
            </div>
          )}

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
              mode === 'login' ? 'Accedi' : mode === 'register' ? 'Crea account' : 'Invia email di reset'
            )}
          </button>
        </form>

        {/* Toggle login / registrazione / torna al login */}
        <p className="text-center text-sm text-zinc-400 mt-6">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => { setMode('login'); setResetSent(false); onClearError(); }}
              className="text-zinc-700 font-medium hover:text-zinc-900 transition-colors underline underline-offset-2"
            >
              ← Torna al login
            </button>
          ) : (
            <>
              {mode === 'login' ? 'Non hai un account?' : 'Hai già un account?'}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="text-zinc-700 font-medium hover:text-zinc-900 transition-colors underline underline-offset-2"
              >
                {mode === 'login' ? 'Registrati' : 'Accedi'}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Reset password ───────────────────────────────────────────────────────────

interface ResetPasswordScreenProps {
  onUpdatePassword: (newPassword: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

function ResetPasswordScreen({ onUpdatePassword, isLoading, error, onClearError }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onClearError();
    setLocalError(null);
    setter(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setLocalError('La password deve avere almeno 6 caratteri.');
      return;
    }
    if (password !== confirm) {
      setLocalError('Le password non coincidono.');
      return;
    }
    await onUpdatePassword(password);
  };

  const displayError = localError ?? error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-4">
      <div className="bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-100 max-w-sm w-full">

        {/* Logo + titolo */}
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-14 h-14 mb-5" />
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
            Nuova password
          </h1>
          <p className="text-zinc-400 mt-2 text-sm text-center leading-relaxed">
            Scegli una nuova password per il tuo account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Nuova password */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Nuova password"
              value={password}
              onChange={handleChange(setPassword)}
              required
              autoComplete="new-password"
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

          {/* Conferma password */}
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Conferma password"
            value={confirm}
            onChange={handleChange(setConfirm)}
            required
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all"
          />

          {/* Errore */}
          {displayError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-zinc-900 text-white rounded-xl py-3 px-4 font-medium hover:bg-zinc-800 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {isLoading ? <Spinner size="sm" className="border-zinc-500 border-t-white" /> : 'Salva nuova password'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate() {
  const {
    user, isAuthReady, isLoggingIn, isRecoveryMode,
    loginEmail, registerEmail, resetPassword, updatePassword,
    logoutUser, error, clearError,
  } = useAuth();

  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  const handleWarn   = useCallback(() => setShowTimeoutWarning(true),  []);
  const handleAutoLogout = useCallback(async () => {
    setShowTimeoutWarning(false);
    await logoutUser();
  }, [logoutUser]);

  const { resetTimers } = useSessionTimeout({
    isActive: !!user && !isRecoveryMode,
    onWarn:   handleWarn,
    onLogout: handleAutoLogout,
  });

  const handleStay = useCallback(() => {
    setShowTimeoutWarning(false);
    resetTimers();
  }, [resetTimers]);

  return (
    <>
      {/* Splash screen premium: overlay che svanisce quando l'auth è pronta */}
      <LoadingScreen isReady={isAuthReady} />

      {/* Contenuto reale — visibile solo dopo che l'auth è pronta */}
      {isAuthReady && (() => {
        if (isRecoveryMode) {
          return (
            <ResetPasswordScreen
              onUpdatePassword={updatePassword}
              isLoading={isLoggingIn}
              error={error}
              onClearError={clearError}
            />
          );
        }
        if (!user) {
          return (
            <LoginScreen
              onEmailLogin={loginEmail}
              onEmailRegister={registerEmail}
              onResetPassword={resetPassword}
              isLoading={isLoggingIn}
              error={error}
              onClearError={clearError}
            />
          );
        }
        return (
          <>
            <CalendarPage user={user} />
            {showTimeoutWarning && (
              <SessionTimeoutModal
                onStay={handleStay}
                onLogout={handleAutoLogout}
              />
            )}
          </>
        );
      })()}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  );
}
