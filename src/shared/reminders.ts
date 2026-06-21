import { addMinutes, parseISO, subMinutes } from 'date-fns';
import type { CalendarEvent, Reminder, Task } from './types';

export function buildEventReminders(event: CalendarEvent): Reminder[] {
  return event.reminders.map((offset) => ({
    id: `rem_event_${event.id}_${offset.minutesBefore}`,
    targetType: 'event',
    targetId: event.id,
    title: event.title,
    triggerAt: subMinutes(parseISO(event.startsAt), offset.minutesBefore).toISOString()
  }));
}

export function buildTaskReminders(task: Task): Reminder[] {
  const triggerBase = task.endsAt ?? task.dueAt;
  if (!triggerBase) {
    return [];
  }

  return task.reminders.map((offset) => ({
    id: `rem_task_${task.id}_${offset.minutesBefore}`,
    targetType: 'task',
    targetId: task.id,
    title: task.title,
    triggerAt: subMinutes(parseISO(triggerBase), offset.minutesBefore).toISOString()
  }));
}

export function getDueReminders(reminders: Reminder[], now = new Date()): Reminder[] {
  return reminders.filter((reminder) => !reminder.firedAt && !reminder.dismissedAt && parseISO(reminder.triggerAt) <= now);
}

export function getMissedReminders(reminders: Reminder[], now = new Date(), hours = 24): Reminder[] {
  const since = addMinutes(now, -hours * 60);
  return reminders.filter((reminder) => {
    const triggerAt = parseISO(reminder.triggerAt);
    return !reminder.dismissedAt && triggerAt >= since && triggerAt < now;
  });
}
