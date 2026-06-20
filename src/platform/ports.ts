import type { AppSettings, PlannerState, Reminder } from '../shared/types';

export interface StoragePort {
  load(): Promise<PlannerState>;
  save(state: PlannerState): Promise<void>;
}

export interface NotificationPort {
  requestPermission(): Promise<boolean>;
  send(title: string, body: string): Promise<void>;
}

export interface AutostartPort {
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
}

export interface ReminderSchedulerPort {
  schedule(reminders: Reminder[]): Promise<void>;
}

export interface PlatformPorts {
  storage: StoragePort;
  notifications: NotificationPort;
  autostart: AutostartPort;
  reminders: ReminderSchedulerPort;
}

export interface SettingsPort {
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<void>;
}
