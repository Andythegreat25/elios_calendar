export type CalendarType = 'user' | 'room' | 'shared';

export interface Profile {
  uid: string;
  displayName: string;
  color: string;
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  type: CalendarType;
  ownerId: string;
  visible?: boolean; // UI state only
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date; // Keep Date for UI, but we'll store as string YYYY-MM-DD in Firestore
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  calendarId: string;
  description?: string;
  ownerId: string;
  createdAt: string;
}
