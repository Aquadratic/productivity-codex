import { describe, expect, it } from 'vitest';
import { normalizePlannerState, normalizeSettings } from './settings';

describe('settings', () => {
  it('adds new defaults to old settings', () => {
    expect(normalizeSettings({ notificationsEnabled: false }).showCalendarEventsInTasks).toBe(true);
    expect(normalizeSettings({ notificationsEnabled: false }).calendarStartHour).toBe(6);
    expect(normalizeSettings({ notificationsEnabled: false }).calendarEndHour).toBe(22);
  });

  it('normalizes older planner state', () => {
    const state = normalizePlannerState({ settings: { notificationsEnabled: true, autostartEnabled: false, defaultReminderMinutes: 5 } });

    expect(state.events).toEqual([]);
    expect(state.settings.calendarEndHour).toBe(22);
  });
});
