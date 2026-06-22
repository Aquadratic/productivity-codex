import { darkThemeColors, defaultSettings, lightThemeColors, type AppSettings, type CompletionRecord, type PlannerState, type ThemeColors } from './types';

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
    showEventsInCalendar: merged.showEventsInCalendar ?? defaultSettings.showEventsInCalendar,
    showTasksInCalendar: merged.showTasksInCalendar ?? defaultSettings.showTasksInCalendar,
    showTaskItemsInTasks: merged.showTaskItemsInTasks ?? defaultSettings.showTaskItemsInTasks,
    sidebarCollapsed: typeof merged.sidebarCollapsed === 'boolean' ? merged.sidebarCollapsed : defaultSettings.sidebarCollapsed,
    popupPosition: normalizePopupPosition(merged.popupPosition),
    themePreset: normalizeThemePreset(merged.themePreset),
    themeColors: normalizeThemeColors(merged.themePreset, merged.themeColors),
    calendarStartHour,
    calendarEndHour: calendarEndHour === calendarStartHour ? defaultSettings.calendarEndHour : calendarEndHour,
    soundVolume,
    timerCompleteSound: merged.timerCompleteSound || defaultSettings.timerCompleteSound,
    lastTimerDurationSeconds: typeof merged.lastTimerDurationSeconds === 'number' && merged.lastTimerDurationSeconds > 0
      ? Math.floor(merged.lastTimerDurationSeconds)
      : defaultSettings.lastTimerDurationSeconds,
    pomodoroFocusMinutes: clampPositiveNumber(merged.pomodoroFocusMinutes, defaultSettings.pomodoroFocusMinutes),
    pomodoroShortBreakMinutes: clampPositiveNumber(merged.pomodoroShortBreakMinutes, defaultSettings.pomodoroShortBreakMinutes),
    pomodoroLongBreakMinutes: clampPositiveNumber(merged.pomodoroLongBreakMinutes, defaultSettings.pomodoroLongBreakMinutes),
    pomodoroSessionsBeforeLongBreak: clampPositiveNumber(merged.pomodoroSessionsBeforeLongBreak, defaultSettings.pomodoroSessionsBeforeLongBreak)
  };
}

export function normalizePlannerState(state: PersistedPlannerState): PlannerState {
  return {
    events: (state.events ?? []).map((event) => ({
      ...event,
      notes: event.notes ?? '',
      allDay: event.allDay ?? false,
      color: event.color ?? lightThemeColors.eventDefault,
      importance: normalizeImportance(event.importance),
      reminders: Array.isArray(event.reminders) ? event.reminders : [],
      completedOccurrences: normalizeCompletionRecords(event.completedOccurrences, event.updatedAt ?? event.startsAt)
    })),
    tasks: (state.tasks ?? []).map((task) => ({
      ...task,
      notes: task.notes ?? '',
      status: normalizeTaskStatus(task.status),
      priority: normalizePriority(task.priority),
      color: typeof task.color === 'string' ? task.color : undefined,
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

function clampPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && !Number.isNaN(value) && value > 0 ? Math.round(value) : fallback;
}

function normalizeThemePreset(value: unknown): AppSettings['themePreset'] {
  return value === 'dark' || value === 'custom' ? value : 'light';
}

function normalizeThemeColors(preset: unknown, value: unknown): ThemeColors {
  const base = preset === 'dark' ? darkThemeColors : lightThemeColors;
  const colors = value && typeof value === 'object' ? value as Partial<ThemeColors> : {};
  return {
    sidebar: typeof colors.sidebar === 'string' ? colors.sidebar : base.sidebar,
    pageBackground: typeof colors.pageBackground === 'string' ? colors.pageBackground : base.pageBackground,
    panelBackground: typeof colors.panelBackground === 'string' ? colors.panelBackground : base.panelBackground,
    accent: typeof colors.accent === 'string' ? colors.accent : base.accent,
    taskDefault: typeof colors.taskDefault === 'string' ? colors.taskDefault : base.taskDefault,
    eventDefault: typeof colors.eventDefault === 'string' ? colors.eventDefault : base.eventDefault,
    textPrimary: typeof colors.textPrimary === 'string' ? colors.textPrimary : base.textPrimary,
    textMuted: typeof colors.textMuted === 'string' ? colors.textMuted : base.textMuted,
    textOnAccent: typeof colors.textOnAccent === 'string' ? colors.textOnAccent : base.textOnAccent
  };
}

function normalizePopupPosition(value: unknown): AppSettings['popupPosition'] {
  if (
    value &&
    typeof value === 'object' &&
    'x' in value &&
    'y' in value &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y)
  ) {
    return {
      x: Math.max(0, Math.round(value.x)),
      y: Math.max(0, Math.round(value.y))
    };
  }

  return defaultSettings.popupPosition;
}
