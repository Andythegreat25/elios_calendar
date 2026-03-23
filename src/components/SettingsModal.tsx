import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Trash2, Link, Eye, EyeOff } from 'lucide-react';
import type { Profile } from '@/types';
import { Spinner } from '@/components/ui/Spinner';
import { uploadProfilePhoto, deleteProfilePhoto } from '@/services/storage.service';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onSave: (updates: Partial<Omit<Profile, 'uid'>>) => Promise<void>;
  onUpdatePassword?: (newPassword: string) => Promise<void>;
}

/**
 * Ridimensiona un'immagine a max 400×400 e la restituisce come Blob JPEG.
 * Mantiene le proporzioni originali.
 * Il Blob viene poi caricato su Firebase Storage (non più salvato come base64
 * in Firestore, il che riduceva le performance per tutti i client).
 */
function resizeImageToBlob(file: File, maxSize = 400, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Conversione immagine fallita'))),
          'image/jpeg',
          quality,
        );
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SettingsModal({ isOpen, onClose, profile, onSave, onUpdatePassword }: SettingsModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('#a881f3');
  const [photoURL, setPhotoURL] = useState('');
  const [icsUrl, setIcsUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isTestingIcs, setIsTestingIcs] = useState(false);
  const [icsTestResult, setIcsTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setDisplayName(profile.displayName ?? '');
      setColor(profile.color ?? '#a881f3');
      setPhotoURL(profile.photoURL ?? '');
      setIcsUrl(profile.icsUrl ?? '');
      setModalError(null);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
    }
  }, [isOpen, profile]);

  const handleTestIcs = async () => {
    const url = icsUrl.trim();
    if (!url) return;
    setIsTestingIcs(true);
    setIcsTestResult(null);
    try {
      const res = await fetch(`/api/ics-proxy?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`Errore HTTP ${res.status}`);
      const text = await res.text();
      const count = (text.match(/BEGIN:VEVENT/g) ?? []).length;
      setIcsTestResult({ ok: true, msg: `Feed valido — ${count} event${count === 1 ? 'o' : 'i'} trovati` });
    } catch (err) {
      setIcsTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Feed non raggiungibile' });
    } finally {
      setIsTestingIcs(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setIsProcessingImage(true);
    setModalError(null);
    try {
      const blob = await resizeImageToBlob(file);
      const url = await uploadProfilePhoto(profile.uid, blob);
      setPhotoURL(url);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Errore caricamento foto');
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (profile) {
      // Rimuove il file da Storage (best-effort, non blocca l'UI se fallisce)
      deleteProfilePhoto(profile.uid).catch(() => {});
    }
    setPhotoURL('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setModalError(null);

    const trimmedIcs = icsUrl.trim();
    if (trimmedIcs && !trimmedIcs.startsWith('http://') && !trimmedIcs.startsWith('https://')) {
      setModalError("L'URL del feed ICS deve iniziare con https://");
      setIsSaving(false);
      return;
    }

    try {
      await onSave({
        displayName: displayName.trim(),
        color,
        photoURL: photoURL || undefined,
        icsUrl: trimmedIcs || undefined,
      });
      onClose();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Errore salvataggio profilo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError('La password deve avere almeno 6 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono.');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await onUpdatePassword!(newPassword);
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Errore aggiornamento password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const initials = displayName?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">Impostazioni Profilo</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-3">
            {/* Avatar cliccabile */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                title="Cambia foto profilo"
              >
                {isProcessingImage ? (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-100">
                    <Spinner size="md" />
                  </div>
                ) : photoURL ? (
                  <img
                    src={photoURL}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white font-semibold text-3xl"
                    style={{ backgroundColor: color }}
                  >
                    {initials}
                  </div>
                )}
                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-7 h-7 text-white" />
                </div>
              </button>

              {/* Badge "rimuovi" quando c'è una foto */}
              {photoURL && !isProcessingImage && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -bottom-1 -right-1 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-md transition-colors"
                  title="Rimuovi foto"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>

            <p className="text-xs text-zinc-400">
              Clicca per caricare una foto · JPG, PNG, WebP
            </p>

            {/* Input file nascosto */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Nome Visualizzato
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all text-sm"
            />
          </div>

          {/* Colore */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Colore Profilo
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
              />
              <span className="text-sm text-zinc-500 font-mono uppercase">{color}</span>
            </div>
          </div>

          {/* ICS Feed Outlook */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Calendario Outlook (ICS Feed)
            </label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="url"
                placeholder="https://outlook.office.com/owa/calendar/..."
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-zinc-400 flex-1">
                In Outlook: File → Impostazioni account → Calendari Internet → copia l'URL ICS.
              </p>
              {icsUrl.trim() && (
                <button
                  type="button"
                  onClick={handleTestIcs}
                  disabled={isTestingIcs}
                  className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 rounded-lg px-2 py-1 transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {isTestingIcs ? '...' : 'Testa'}
                </button>
              )}
            </div>
            {icsTestResult && (
              <p className={`text-xs mt-1 font-medium ${icsTestResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                {icsTestResult.ok ? '✓' : '✗'} {icsTestResult.msg}
              </p>
            )}
          </div>

          {modalError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {modalError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving || isProcessingImage}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Spinner size="sm" className="border-zinc-500 border-t-white" />
                Salvataggio...
              </>
            ) : (
              'Salva Modifiche'
            )}
          </button>
        </form>

        {/* Sezione cambio password — separata dal form profilo */}
        {onUpdatePassword && (
          <div className="px-6 pb-6">
            <div className="border-t border-zinc-100 pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-700">Cambia Password</h3>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Nuova password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }}
                    autoComplete="new-password"
                    className="w-full px-4 py-2.5 pr-11 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all text-sm"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Conferma nuova password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); setPasswordSuccess(false); }}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all text-sm"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                  {passwordError}
                </p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                  Password aggiornata con successo.
                </p>
              )}

              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {isUpdatingPassword ? (
                  <>
                    <Spinner size="sm" className="border-zinc-300 border-t-zinc-700" />
                    Aggiornamento...
                  </>
                ) : (
                  'Aggiorna Password'
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
