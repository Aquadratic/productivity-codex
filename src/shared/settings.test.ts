import { describe, expect, it } from 'vitest';
import { normalizePlannerState, normalizeSettings } from './settings';

describe('settings', () => {
  it('adds new defaults to old settings', () => {
    expect(normalizeSettings({ notificationsEnabled: false }).showCalendarEventsInTasks).toBe(true);
    expect(normalizeSettings({ notificationsEnabled: false }).calendarStartHour).toBe(6);
    expect(normalizeSettings({ notificationsEnabled: false }).calendarEndHour).toBe(22);
    expect(normalizeSettings({ notificationsEnabled: false }).lastTimerDurationSeconds).toBe(1500);
  });

  it('normalizes older planner state', () => {
    const state = normalizePlannerState({ settings: { notificationsEnabled: true, autostartEnabled: false, defaultReminderMinutes: 5 } });

    expect(state.events).toEqual([]);
    expect(state.settings.calendarEndHour).toBe(22);
  });

  it('migrates event colors and old completion records', () => {
    const state = normalizePlannerState({
      events: [
        {
          id: 'event_1',
          title: 'Class',
          notes: '',
          startsAt: '2026-06-20T15:00:00.000Z',
          endsAt: '2026-06-20T16:00:00.000Z',
          allDay: false,
          importance: 'normal',
          reminders: [],
          completedOccurrences: ['2026-06-20T15:00:00.000Z'] as never,
          createdAt: '2026-06-20T00:00:00.000Z',
          updatedAt: '2026-06-20T17:00:00.000Z'
        } as never
      ],
      tasks: [
        {
          id: 'task_1',
          title: 'Homework',
          notes: '',
          status: 'completed',
          priority: 'normal',
          allDay: false,
          dueAt: '2026-06-20T14:00:00.000Z',
          reminders: [],
          completedOccurrences: ['2026-06-20T14:00:00.000Z'] as never,
          createdAt: '2026-06-20T00:00:00.000Z',
          updatedAt: '2026-06-20T18:00:00.000Z'
        } as never
      ]
    });

    expect(state.events[0].color).toBe('#5578a6');
    expect(state.events[0].completedOccurrences).toEqual([
      { occurrenceKey: '2026-06-20T15:00:00.000Z', completedAt: '2026-06-20T17:00:00.000Z' }
    ]);
    expect(state.tasks[0].completedOccurrences).toEqual([
      { occurrenceKey: '2026-06-20T14:00:00.000Z', completedAt: '2026-06-20T18:00:00.000Z' }
    ]);
  });

  it('normalizes old and missing event and task values to defaults', () => {
    const state = normalizePlannerState({
      events: [
        {
          id: 'event_1',
          title: 'Class',
          startsAt: '2026-06-20T15:00:00.000Z',
          endsAt: '2026-06-20T16:00:00.000Z',
          importance: 'important',
          createdAt: '2026-06-20T00:00:00.000Z',
          updatedAt: '2026-06-20T00:00:00.000Z'
        } as never
      ],
      tasks: [
        {
          id: 'task_1',
          title: 'Homework',
          dueAt: '2026-06-20T14:00:00.000Z',
          createdAt: '2026-06-20T00:00:00.000Z',
          updatedAt: '2026-06-20T00:00:00.000Z'
        } as never
      ],
      settings: { lastTimerDurationSeconds: -1 }
    });

    expect(state.events[0]).toMatchObject({
      notes: '',
      allDay: false,
      importance: 'high',
      reminders: []
    });
    expect(state.tasks[0]).toMatchObject({
      notes: '',
      status: 'open',
      priority: 'normal',
      startsAt: '2026-06-20T14:00:00.000Z',
      endsAt: '2026-06-20T14:00:00.000Z',
      allDay: false,
      reminders: []
    });
    expect(state.settings.lastTimerDurationSeconds).toBe(1500);
  });
});
