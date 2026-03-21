import { useState, useCallback } from 'react';
import type { RecurrenceType } from '@/types';

export interface EventTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  calendarId: string;
  recurrence: RecurrenceType;
  description?: string;
}

const STORAGE_KEY = 'elios-event-templates';

function loadTemplates(): EventTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as EventTemplate[];
  } catch {}
  return [];
}

function saveTemplates(templates: EventTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {}
}

export function useEventTemplates() {
  const [templates, setTemplates] = useState<EventTemplate[]>(() => loadTemplates());

  const addTemplate = useCallback((template: Omit<EventTemplate, 'id'>) => {
    const newTemplate: EventTemplate = { ...template, id: crypto.randomUUID() };
    setTemplates((prev) => {
      const updated = [...prev, newTemplate];
      saveTemplates(updated);
      return updated;
    });
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveTemplates(updated);
      return updated;
    });
  }, []);

  return { templates, addTemplate, removeTemplate };
}
