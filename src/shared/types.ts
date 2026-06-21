export type ID = string;

export type Importance = 'low' | 'normal' | 'high';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskStatus = 'open' | 'completed';
export type TimerMode = 'focus' | 'break';
export type UpcomingRange = 'today' | '7days' | '30days' | 'all';
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ThemePreset = 'light' | 'dark' | 'custom';

export interface ThemeColors {
  sidebar: string;
  pageBackground: string;
  panelBackground: string;
  accent: string;
  taskDefault: string;
  eventDefault: string;
}

export interface CompletionRecord {
  occurrenceKey: string;
  completedAt: string;
}

export interface ReminderOffset {
  minutesBefore: number;
}

export interface CalendarEvent {
  id: ID;
  title: string;
  notes: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  importance: Importance;
  color: string;
  recurrenceRule?: string;
  reminders: ReminderOffset[];
  completedOccurrences: CompletionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: ID;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  color?: string;
  startsAt?: string;
  endsAt?: string;
  dueAt?: string;
  allDay: boolean;
  recurrenceRule?: string;
  reminders: ReminderOffset[];
  completedOccurrences: CompletionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface TimerSession {
  id: ID;
  mode: TimerMode;
  durationSeconds: number;
  startedAt: string;
  endedAt?: string;
  completed: boolean;
}

export interface Reminder {
  id: ID;
  targetType: 'event' | 'task' | 'timer';
  targetId: ID;
  title: string;
  triggerAt: string;
  firedAt?: string;
  dismissedAt?: string;
}

export interface PlannerState {
  events: CalendarEvent[];
  tasks: Task[];
  timerSessions: TimerSession[];
  reminders: Reminder[];
  settings: AppSettings;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  autostartEnabled: boolean;
  defaultReminderMinutes: number;
  showCalendarEventsInTasks: boolean;
  showEventsInCalendar: boolean;
  showTasksInCalendar: boolean;
  sidebarCollapsed: boolean;
  themePreset: ThemePreset;
  themeColors: ThemeColors;
  calendarStartHour: number;
  calendarEndHour: number;
  upcomingRange: UpcomingRange;
  soundsEnabled: boolean;
  soundVolume: number;
  timerCompleteSound: string;
  lastTimerDurationSeconds: number;
  pomodoroFocusMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroSessionsBeforeLongBreak: number;
}

export const lightThemeColors: ThemeColors = {
  sidebar: '#18241f',
  pageBackground: '#eef1eb',
  panelBackground: '#ffffff',
  accent: '#23693c',
  taskDefault: '#23693c',
  eventDefault: '#5578a6'
};

export const darkThemeColors: ThemeColors = {
  sidebar: '#101614',
  pageBackground: '#151a18',
  panelBackground: '#202722',
  accent: '#7bbd8b',
  taskDefault: '#7bbd8b',
  eventDefault: '#8aa8d8'
};

export const defaultSettings: AppSettings = {
  notificationsEnabled: true,
  autostartEnabled: false,
  defaultReminderMinutes: 10,
  showCalendarEventsInTasks: true,
  showEventsInCalendar: true,
  showTasksInCalendar: true,
  sidebarCollapsed: false,
  themePreset: 'light',
  themeColors: lightThemeColors,
  calendarStartHour: 6,
  calendarEndHour: 22,
  upcomingRange: 'all',
  soundsEnabled: true,
  soundVolume: 0.8,
  timerCompleteSound: 'classic-alarm',
  lastTimerDurationSeconds: 1500,
  pomodoroFocusMinutes: 25,
  pomodoroShortBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodoroSessionsBeforeLongBreak: 4
};
