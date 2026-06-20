export type ID = string;

export type Importance = 'normal' | 'important';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskStatus = 'open' | 'completed';
export type TimerMode = 'focus' | 'break';
export type UpcomingRange = 'today' | '7days' | '30days' | 'all';

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
  dueAt?: string;
  recurrenceRule?: string;
  reminders: ReminderOffset[];
  completedOccurrences: string[];
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
  calendarStartHour: number;
  calendarEndHour: number;
  upcomingRange: UpcomingRange;
  soundsEnabled: boolean;
  soundVolume: number;
  timerCompleteSound: string;
}

export const defaultSettings: AppSettings = {
  notificationsEnabled: true,
  autostartEnabled: false,
  defaultReminderMinutes: 10,
  showCalendarEventsInTasks: true,
  calendarStartHour: 6,
  calendarEndHour: 22,
  upcomingRange: 'all',
  soundsEnabled: true,
  soundVolume: 0.8,
  timerCompleteSound: 'gentle-chime'
};
