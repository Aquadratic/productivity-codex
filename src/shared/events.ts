import { isAfter, parseISO } from 'date-fns';
import type { CalendarEvent } from './types';
import { normalizeOccurrenceKey } from './date';

export interface EventValidationInput {
  startsAt: string;
  endsAt: string;
}

export function validateEventTime(input: EventValidationInput): string | undefined {
  const startsAt = parseISO(input.startsAt);
  const endsAt = parseISO(input.endsAt);

  if (!isAfter(endsAt, startsAt)) {
    return 'End time must be after start time.';
  }

  return undefined;
}

export function toggleEventCompletion(event: CalendarEvent, occurrenceAt = event.startsAt): CalendarEvent {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  const existing = event.completedOccurrences.find((record) => record.occurrenceKey === occurrenceKey);

  return {
    ...event,
    completedOccurrences: existing
      ? event.completedOccurrences.filter((record) => record.occurrenceKey !== occurrenceKey)
      : [...event.completedOccurrences, { occurrenceKey, completedAt: new Date().toISOString() }],
    updatedAt: new Date().toISOString()
  };
}

export function isEventOccurrenceCompleted(event: CalendarEvent, occurrenceAt = event.startsAt): boolean {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  return event.completedOccurrences.some((record) => record.occurrenceKey === occurrenceKey);
}
