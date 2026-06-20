import { addDays, endOfDay, formatISO, isSameDay, parseISO, startOfDay } from 'date-fns';

export function toISO(date: Date): string {
  return formatISO(date);
}

export function todayRange(now = new Date()) {
  return {
    start: startOfDay(now),
    end: endOfDay(now)
  };
}

export function isISOOnDay(value: string, day: Date): boolean {
  return isSameDay(parseISO(value), day);
}

export function addDaysISO(value: string, days: number): string {
  return toISO(addDays(parseISO(value), days));
}

export function normalizeOccurrenceKey(value: string): string {
  return parseISO(value).toISOString();
}
