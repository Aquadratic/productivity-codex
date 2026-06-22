import { addMilliseconds, differenceInMilliseconds, isAfter, parseISO } from 'date-fns';
import type { CalendarEvent } from './types';
import { normalizeOccurrenceKey } from './date';
import { nextOccurrence } from './recurrence';

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
  const nextCompletedOccurrences = existing
    ? event.completedOccurrences.filter((record) => record.occurrenceKey !== occurrenceKey)
    : [...event.completedOccurrences, { occurrenceKey, completedAt: new Date().toISOString() }];

  if (existing && event.recurrenceRule) {
    return restoreEventOccurrence({
      ...event,
      completedOccurrences: nextCompletedOccurrences,
      updatedAt: new Date().toISOString()
    }, occurrenceKey);
  }

  if (!existing && event.recurrenceRule) {
    return {
      ...advanceRecurringEvent(event, parseISO(occurrenceKey), true),
      completedOccurrences: nextCompletedOccurrences,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...event,
    completedOccurrences: nextCompletedOccurrences,
    updatedAt: new Date().toISOString()
  };
}

export function isEventOccurrenceCompleted(event: CalendarEvent, occurrenceAt = event.startsAt): boolean {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  return event.completedOccurrences.some((record) => record.occurrenceKey === occurrenceKey);
}

function advanceRecurringEvent(event: CalendarEvent, after = new Date(), includeAfter = false): CalendarEvent {
  if (!event.recurrenceRule) {
    return event;
  }

  const startsAt = parseISO(event.startsAt);
  const endsAt = parseISO(event.endsAt);
  const next = nextOccurrence(startsAt, event.recurrenceRule, after);
  if (!next || (!includeAfter && !isAfter(next, startsAt))) {
    return event;
  }

  const duration = differenceInMilliseconds(endsAt, startsAt);
  return {
    ...event,
    startsAt: next.toISOString(),
    endsAt: addMilliseconds(next, duration).toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function restoreEventOccurrence(event: CalendarEvent, occurrenceKey: string): CalendarEvent {
  const currentStart = parseISO(event.startsAt);
  const currentEnd = parseISO(event.endsAt);
  const duration = differenceInMilliseconds(currentEnd, currentStart);
  const restoredStart = parseISO(occurrenceKey);

  return {
    ...event,
    startsAt: restoredStart.toISOString(),
    endsAt: addMilliseconds(restoredStart, duration).toISOString(),
    updatedAt: new Date().toISOString()
  };
}
