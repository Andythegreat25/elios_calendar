import { startOfWeek, addDays, format, isSameDay, parse, isBefore, isAfter, setHours, setMinutes } from 'date-fns';
import { it } from 'date-fns/locale';

export const getWeekDays = (date: Date): Date[] => {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
};

export const formatTime = (time: string): string => {
  return time; // Assuming HH:mm format
};

export const generateTimeSlots = (startHour: number = 8, endHour: number = 20): string[] => {
  const slots: string[] = [];
  for (let i = startHour; i <= endHour; i++) {
    slots.push(`${i.toString().padStart(2, '0')}:00`);
    if (i !== endHour) {
      slots.push(`${i.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
};

export const isTimeSlotBetween = (slot: string, start: string, end: string): boolean => {
  const slotTime = parse(slot, 'HH:mm', new Date());
  const startTime = parse(start, 'HH:mm', new Date());
  const endTime = parse(end, 'HH:mm', new Date());
  
  return (isAfter(slotTime, startTime) || slotTime.getTime() === startTime.getTime()) && isBefore(slotTime, endTime);
};

export const getEventPosition = (start: string, end: string) => {
  const startParts = start.split(':').map(Number);
  const endParts = end.split(':').map(Number);
  
  const startMinutes = startParts[0] * 60 + startParts[1];
  const endMinutes = endParts[0] * 60 + endParts[1];
  
  const dayStartMinutes = 8 * 60; // 08:00
  
  const top = ((startMinutes - dayStartMinutes) / 30) * 80; // 80px per 30 min slot
  const height = ((endMinutes - startMinutes) / 30) * 80;
  
  return { top, height };
};
