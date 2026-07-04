import type { PlannerState, Reminder } from '../shared/types';
import type { AutostartPort, NotificationPort, PlatformPorts, ReminderSchedulerPort, StoragePort } from './ports';
import { createDefaultState } from './defaultState';
import { normalizePlannerState } from '../shared/settings';

class TauriSqliteStorageAdapter implements StoragePort {
  private databasePromise?: Promise<unknown>;

  private async database(): Promise<any> {
    if (!this.databasePromise) {
      this.databasePromise = import('@tauri-apps/plugin-sql').then(async ({ default: Database }) => {
        const database = await Database.load('sqlite:planner.db');
        await database.execute(
          'CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL)'
        );
        return database;
      });
    }

    return this.databasePromise;
  }

  async load(): Promise<PlannerState> {
    const database = await this.database();
    const rows = (await database.select('SELECT json FROM app_state WHERE id = $1', ['main'])) as Array<{ json: string }>;
    if (!rows.length) {
      return createDefaultState();
    }

    return normalizePlannerState(JSON.parse(rows[0].json));
  }

  async save(state: PlannerState): Promise<void> {
    const database = await this.database();
    await database.execute(
      'INSERT INTO app_state (id, json, updated_at) VALUES ($1, $2, $3) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at',
      ['main', JSON.stringify(state), new Date().toISOString()]
    );
  }
}

class TauriNotificationAdapter implements NotificationPort {
  async requestPermission(): Promise<boolean> {
    const notification = await import('@tauri-apps/plugin-notification');
    let permission = await notification.isPermissionGranted();
    if (!permission) {
      permission = (await notification.requestPermission()) === 'granted';
    }
    return permission;
  }

  async send(title: string, body: string): Promise<void> {
    const notification = await import('@tauri-apps/plugin-notification');
    if (!(await this.requestPermission())) {
      throw new Error('Notification permission was denied.');
    }
    notification.sendNotification({ title, body });
  }
}

class TauriAutostartAdapter implements AutostartPort {
  private supported = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  async isEnabled(): Promise<boolean> {
    if (!this.supported) return false;
    const autostart = await import('@tauri-apps/plugin-autostart');
    return autostart.isEnabled();
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (!this.supported) return;
    const autostart = await import('@tauri-apps/plugin-autostart');
    if (enabled) {
      await autostart.enable();
      return;
    }
    await autostart.disable();
  }
}

class TauriReminderScheduler implements ReminderSchedulerPort {
  private timers: number[] = [];

  async schedule(reminders: Reminder[]): Promise<void> {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    const notifications = new TauriNotificationAdapter();
    this.timers = reminders.map((reminder) => {
      const delay = Math.max(0, new Date(reminder.triggerAt).getTime() - Date.now());
      return window.setTimeout(() => {
        notifications.send('Reminder', reminder.title).catch(() => undefined);
      }, delay);
    });
  }
}

export function createTauriPorts(): PlatformPorts {
  const isAndroid = /Android/i.test(navigator.userAgent);
  return {
    storage: new TauriSqliteStorageAdapter(),
    notifications: new TauriNotificationAdapter(),
    autostart: new TauriAutostartAdapter(),
    reminders: new TauriReminderScheduler(),
    platform: {
      isAndroid,
      isDesktop: !isAndroid,
      supportsAutostart: !isAndroid,
      supportsNotifications: true
    }
  };
}
