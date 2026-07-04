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
    if (!('Notification' in window)) {
      throw new Error('Notifications are not supported in this browser.');
    }
    if (Notification.permission !== 'granted' && !(await this.requestPermission())) {
      throw new Error('Notification permission was denied.');
    }
    new Notification(title, { body });
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
        new BrowserNotificationAdapter().send('Reminder', reminder.title).catch(() => undefined);
      }, delay);
    });
  }
}

export function createBrowserPorts(): PlatformPorts {
  return {
    storage: new LocalStorageAdapter(),
    notifications: new BrowserNotificationAdapter(),
    autostart: new UnsupportedAutostartAdapter(),
    reminders: new InMemoryReminderScheduler(),
    platform: {
      isAndroid: /Android/i.test(navigator.userAgent),
      isDesktop: !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
      supportsAutostart: false,
      supportsNotifications: 'Notification' in window
    }
  };
}
