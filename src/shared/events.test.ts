import { describe, expect, it } from 'vitest';
import { isEventOccurrenceCompleted, toggleEventCompletion, validateEventTime } from './events';
import { createRecurrenceRule } from './recurrence';
import type { CalendarEvent } from './types';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event_1',
    title: 'Class',
    notes: '',
    startsAt: '2026-06-20T15:00:00.000Z',
    endsAt: '2026-06-20T16:00:00.000Z',
    allDay: false,
    importance: 'high',
    color: '#5578a6',
    reminders: [],
    completedOccurrences: [],
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
    ...overrides
  };
}

describe('events', () => {
  it('toggles event occurrence completion', () => {
    const completed = toggleEventCompletion(event());
    const reopened = toggleEventCompletion(completed);

    expect(isEventOccurrenceCompleted(completed)).toBe(true);
    expect(isEventOccurrenceCompleted(reopened)).toBe(false);
  });

  it('advances recurring events and restores an uncompleted occurrence', () => {
    const recurring = toggleEventCompletion(
      event({ recurrenceRule: createRecurrenceRule({ frequency: 'daily', interval: 1 }) }),
      '2026-06-20T15:00:00.000Z'
    );
    const restored = toggleEventCompletion(recurring, '2026-06-20T15:00:00.000Z');

    expect(isEventOccurrenceCompleted(recurring, '2026-06-20T15:00:00.000Z')).toBe(true);
    expect(recurring.startsAt).toBe('2026-06-21T15:00:00.000Z');
    expect(recurring.endsAt).toBe('2026-06-21T16:00:00.000Z');
    expect(restored.completedOccurrences).toEqual([]);
    expect(restored.startsAt).toBe('2026-06-20T15:00:00.000Z');
    expect(restored.endsAt).toBe('2026-06-20T16:00:00.000Z');
  });

  it('rejects same-day end before start', () => {
    expect(validateEventTime({
      startsAt: '2026-06-20T16:00:00.000Z',
      endsAt: '2026-06-20T15:00:00.000Z'
    })).toBe('End time must be after start time.');
  });

  it('allows multi-day events', () => {
    expect(validateEventTime({
      startsAt: '2026-06-20T23:00:00.000Z',
      endsAt: '2026-06-21T01:00:00.000Z'
    })).toBeUndefined();
  });
});
