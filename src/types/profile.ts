/**
 * Rappresenta il profilo di un utente autenticato.
 * Corrisponde al documento Firestore in /profiles/{userId}.
 */
export interface Profile {
  uid: string;
  displayName: string;
  /** Colore hex personalizzato dell'utente (es. "#a881f3") */
  color: string;
  /** URL dell'immagine profilo (opzionale, da Google o inserita manualmente) */
  photoURL?: string;
  /** URL del feed ICS Outlook/Google Calendar (opzionale, per overlay read-only) */
  icsUrl?: string;
}
