import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Profile } from '@/types';
import { Spinner } from '@/components/ui/Spinner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onSave: (updates: Partial<Omit<Profile, 'uid'>>) => Promise<void>;
}

export function SettingsModal({ isOpen, onClose, profile, onSave }: SettingsModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('#a881f3');
  const [photoURL, setPhotoURL] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && profile) {
      setDisplayName(profile.displayName ?? '');
      setColor(profile.color ?? '#a881f3');
      setPhotoURL(profile.photoURL ?? '');
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({ displayName: displayName.trim(), color, photoURL: photoURL.trim() || undefined });
      onClose();
    } catch {
      // L'errore viene già gestito nel hook useProfiles tramite Toast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
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
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            {photoURL ? (
              <img
                src={photoURL}
                alt="Preview"
                className="w-16 h-16 rounded-full object-cover border border-zinc-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white font-medium text-xl"
                style={{ backgroundColor: color }}
              >
                {displayName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                URL Foto Profilo (opzionale)
              </label>
              <input
                type="url"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all text-sm"
              />
            </div>
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

          <button
            type="submit"
            disabled={isSaving}
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
      </div>
    </div>
  );
}
