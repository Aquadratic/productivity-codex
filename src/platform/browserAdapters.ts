import type { AutostartPort, NotificationPort, PlatformPorts, ReminderSchedulerPort } from './ports';
import type { Reminder } from '../shared/types';
import { LocalStorageAdapter } from './localStorageAdapter';

class BrowserNotificationAdapter implements NotificationPort {
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  async send(title: string, body: string): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
}

class UnsupportedAutostartAdapter implements AutostartPort {
  async isEnabled(): Promise<boolean> {
    return false;
  }

  async setEnabled(): Promise<void> {
    return undefined;
  }
}

class InMemoryReminderScheduler implements ReminderSchedulerPort {
  private timers: number[] = [];

  async schedule(reminders: Reminder[]): Promise<void> {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers = reminders.map((reminder) => {
      const delay = Math.max(0, new Date(reminder.triggerAt).getTime() - Date.now());
      return window.setTimeout(() => {
        new BrowserNotificationAdapter().send('Reminder', reminder.title);
      }, delay);
    });
  }
}

export function createBrowserPorts(): PlatformPorts {
  return {
    storage: new LocalStorageAdapter(),
    notifications: new BrowserNotificationAdapter(),
    autostart: new UnsupportedAutostartAdapter(),
    reminders: new InMemoryReminderScheduler()
  };
}
