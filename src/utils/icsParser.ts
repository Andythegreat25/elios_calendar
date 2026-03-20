/**
 * Parser ICS (iCalendar RFC 5545) minimale — nessuna dipendenza esterna.
 *
 * Gestisce:
 * - Line unfolding (CRLF + spazio/tab → riga continua)
 * - DTSTART/DTEND nelle varianti:
 *     DTSTART:20240315T090000Z         → UTC (convertito a locale)
 *     DTSTART;TZID=Europe/Rome:...     → timezone (trattato come locale, ±1h accettabile)
 *     DTSTART;VALUE=DATE:20240315      → tutto il giorno
 * - SUMMARY, UID, DESCRIPTION
 * - Ignora RRULE (le singole istanze di eventi ricorrenti nel feed sono già espanse da Outlook)
 *
 * Non gestisce: VTIMEZONE, VALARM, nested components.
 */

export interface ExternalEvent {
  /** UID originale del VEVENT ICS */
  uid: string;
  title: string;
  date: Date;
  /** HH:MM */
  startTime: string;
  /** HH:MM */
  endTime: string;
  /** UID Firestore del profilo proprietario */
  ownerUid: string;
  /** Nome visualizzato del proprietario (per label/tooltip) */
  ownerName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rimuove il folding ICS: CRLF seguito da spazio o tab è una continuazione di riga. */
function unfold(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '') // unfold continuation lines
    .split('\n');
}

/**
 * Parsa un valore DTSTART/DTEND ICS.
 *
 * @param value  - il valore dopo i `:` (es. "20240315T090000Z")
 * @param isAllDay - true se la property aveva VALUE=DATE
 * @returns { date, time } oppure null se non parsabile
 */
function parseDt(
  value: string,
  isAllDay: boolean,
): { date: Date; time: string } | null {
  const v = value.trim();

  // All-day: YYYYMMDD
  if (isAllDay || /^\d{8}$/.test(v)) {
    const s = v.replace(/\D/g, '').slice(0, 8);
    if (s.length < 8) return null;
    const y = +s.slice(0, 4), m = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
    return { date: new Date(y, m, d), time: '00:00' };
  }

  // Datetime: YYYYMMDDTHHmmss[Z]
  const match = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) return null;

  const [, yr, mo, dy, hh, mm, , utc] = match;
  let dt: Date;
  if (utc === 'Z') {
    // UTC → locale
    dt = new Date(Date.UTC(+yr, +mo - 1, +dy, +hh, +mm, 0));
  } else {
    // Floating / TZID — trattiamo come locale (piccola imprecisione ±1h accettabile
    // per "mostrare giorni occupati")
    dt = new Date(+yr, +mo - 1, +dy, +hh, +mm, 0);
  }

  const localDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  return { date: localDate, time };
}

// ─── Parser principale ────────────────────────────────────────────────────────

/**
 * Parsa il testo di un file .ics e restituisce la lista di ExternalEvent.
 *
 * @param icsText   - contenuto grezzo del file ICS
 * @param ownerUid  - uid Firestore del profilo che ha configurato questo feed
 * @param ownerName - nome visualizzato del proprietario
 */
export function parseIcs(
  icsText: string,
  ownerUid: string,
  ownerName: string,
): ExternalEvent[] {
  const lines = unfold(icsText);
  const events: ExternalEvent[] = [];

  let inEvent = false;
  let uid = '';
  let title = '';
  let dtstartRaw = '';
  let dtendRaw = '';
  let startIsAllDay = false;
  let endIsAllDay = false;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      uid = '';
      title = '';
      dtstartRaw = '';
      dtendRaw = '';
      startIsAllDay = false;
      endIsAllDay = false;
      continue;
    }

    if (line === 'END:VEVENT') {
      if (!inEvent || !dtstartRaw) { inEvent = false; continue; }
      inEvent = false;

      const start = parseDt(dtstartRaw, startIsAllDay);
      if (!start) continue;

      // Se DTEND mancante (alcuni feed lo omettono per eventi puntali), usa startTime
      const end = dtendRaw ? parseDt(dtendRaw, endIsAllDay) : null;
      const endTime = end ? end.time : start.time;

      // Normalizza: se endTime <= startTime ma stessa data → aggiungi 30min
      // con carry corretto sui minuti (es. 09:45 + 30min = 10:15, non "09:75")
      const finalEndTime = (() => {
        if (endTime > start.time || startIsAllDay) return endTime;
        const [hStr, mStr] = start.time.split(':');
        const totalMinutes = +hStr * 60 + +mStr + 30;
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      })();

      // All-day: mostra come 00:00–23:59 così occupa la colonna intera nel grid
      const displayStart = startIsAllDay ? '00:00' : start.time;
      const displayEnd = startIsAllDay ? '23:59' : finalEndTime;

      events.push({
        uid: uid || `${ownerUid}_${dtstartRaw}`,
        title: title || 'Occupato',
        date: start.date,
        startTime: displayStart,
        endTime: displayEnd,
        ownerUid,
        ownerName,
      });
      continue;
    }

    if (!inEvent) continue;

    // Trova il primo ':' che separa property-name da value
    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;

    const propPart = line.slice(0, colonIdx);       // es. "DTSTART;TZID=Europe/Rome"
    const val = line.slice(colonIdx + 1);           // es. "20240315T100000"
    const propName = propPart.split(';')[0].toUpperCase();

    switch (propName) {
      case 'SUMMARY':
        // Decodifica escape ICS (\, \n \;)
        title = val
          .replace(/\\,/g, ',')
          .replace(/\\n/g, ' ')
          .replace(/\\;/g, ';')
          .replace(/\\\\/g, '\\')
          .trim();
        break;
      case 'UID':
        uid = val.trim();
        break;
      case 'DTSTART': {
        const propUpper = propPart.toUpperCase();
        startIsAllDay =
          propUpper.includes('VALUE=DATE') && !propUpper.includes('VALUE=DATE-TIME');
        dtstartRaw = val.trim();
        break;
      }
      case 'DTEND': {
        const propUpper = propPart.toUpperCase();
        endIsAllDay =
          propUpper.includes('VALUE=DATE') && !propUpper.includes('VALUE=DATE-TIME');
        dtendRaw = val.trim();
        break;
      }
    }
  }

  return events;
}
