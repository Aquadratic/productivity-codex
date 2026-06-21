import { defaultSettings, type AppSettings, type CompletionRecord, type PlannerState } from './types';

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
    timerCompleteSound: merged.timerCompleteSound || defaultSettings.timerCompleteSound,
    lastTimerDurationSeconds: typeof merged.lastTimerDurationSeconds === 'number' && merged.lastTimerDurationSeconds > 0
      ? Math.floor(merged.lastTimerDurationSeconds)
      : defaultSettings.lastTimerDurationSeconds
  };
}

export function normalizePlannerState(state: PersistedPlannerState): PlannerState {
  return {
    events: (state.events ?? []).map((event) => ({
      ...event,
      notes: event.notes ?? '',
      allDay: event.allDay ?? false,
      color: event.color ?? '#5578a6',
      importance: normalizeImportance(event.importance),
      reminders: Array.isArray(event.reminders) ? event.reminders : [],
      completedOccurrences: normalizeCompletionRecords(event.completedOccurrences, event.updatedAt ?? event.startsAt)
    })),
    tasks: (state.tasks ?? []).map((task) => ({
      ...task,
      notes: task.notes ?? '',
      status: normalizeTaskStatus(task.status),
      priority: normalizePriority(task.priority),
      allDay: task.allDay ?? false,
      startsAt: task.startsAt ?? task.dueAt,
      endsAt: task.endsAt ?? task.dueAt,
      reminders: Array.isArray(task.reminders) ? task.reminders : [],
      completedOccurrences: normalizeCompletionRecords(task.completedOccurrences, task.updatedAt ?? task.dueAt ?? task.createdAt)
    })),
    timerSessions: state.timerSessions ?? [],
    reminders: state.reminders ?? [],
    settings: normalizeSettings(state.settings)
  };
}

function normalizeImportance(value: unknown): 'low' | 'normal' | 'high' {
  if (value === 'low' || value === 'normal' || value === 'high') {
    return value;
  }

  return value === 'important' ? 'high' : 'normal';
}

function normalizePriority(value: unknown): 'low' | 'normal' | 'high' {
  return value === 'low' || value === 'normal' || value === 'high' ? value : 'normal';
}

function normalizeTaskStatus(value: unknown): 'open' | 'completed' {
  return value === 'completed' ? 'completed' : 'open';
}

function normalizeCompletionRecords(value: unknown, fallbackCompletedAt: string): CompletionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((record) => {
      if (typeof record === 'string') {
        return { occurrenceKey: record, completedAt: fallbackCompletedAt };
      }

      if (
        record &&
        typeof record === 'object' &&
        'occurrenceKey' in record &&
        typeof record.occurrenceKey === 'string'
      ) {
        return {
          occurrenceKey: record.occurrenceKey,
          completedAt: 'completedAt' in record && typeof record.completedAt === 'string'
            ? record.completedAt
            : fallbackCompletedAt
        };
      }

      return undefined;
    })
    .filter((record): record is CompletionRecord => Boolean(record));
}

function clampHour(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.min(24, Math.max(0, Math.round(value)));
}
