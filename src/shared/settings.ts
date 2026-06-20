import { defaultSettings, type AppSettings, type PlannerState } from './types';

type PersistedPlannerState = Omit<Partial<PlannerState>, 'settings'> & {
  settings?: Partial<AppSettings>;
};

export function normalizeSettings(settings: Partial<AppSettings> | undefined): AppSettings {
  const merged = {
    ...defaultSettings,
    ...settings
  };

  const calendarStartHour = clampHour(merged.calendarStartHour, defaultSettings.calendarStartHour);
  const calendarEndHour = clampHour(merged.calendarEndHour, defaultSettings.calendarEndHour);
  const soundVolume = typeof merged.soundVolume === 'number' && !Number.isNaN(merged.soundVolume)
    ? Math.min(1, Math.max(0, merged.soundVolume))
    : defaultSettings.soundVolume;

  return {
    ...merged,
    upcomingRange: ['today', '7days', '30days', 'all'].includes(merged.upcomingRange) ? merged.upcomingRange : defaultSettings.upcomingRange,
    calendarStartHour,
    calendarEndHour: calendarEndHour === calendarStartHour ? defaultSettings.calendarEndHour : calendarEndHour,
    soundVolume,
    timerCompleteSound: merged.timerCompleteSound || defaultSettings.timerCompleteSound
  };
}

export function normalizePlannerState(state: PersistedPlannerState): PlannerState {
  return {
    events: (state.events ?? []).map((event) => ({
      ...event,
      completedOccurrences: event.completedOccurrences ?? []
    })),
    tasks: state.tasks ?? [],
    timerSessions: state.timerSessions ?? [],
    reminders: state.reminders ?? [],
    settings: normalizeSettings(state.settings)
  };
}

function clampHour(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(24, Math.max(0, Math.round(value)));
}
