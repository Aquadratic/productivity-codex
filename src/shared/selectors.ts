import { addDays, isAfter, isBefore, isSameDay, parseISO } from 'date-fns';
import type { CalendarEvent, PlannerState, Task, UpcomingRange } from './types';
import { isEventOccurrenceCompleted } from './events';

export type PlannerItemKind = 'task' | 'event';

export interface PlannerListItem {
  id: string;
  kind: PlannerItemKind;
  title: string;
  notes: string;
  startsAt?: string;
  endsAt?: string;
  dueAt?: string;
  priority?: Task['priority'];
  importance?: CalendarEvent['importance'];
  status?: Task['status'];
  completed: boolean;
  source: Task | CalendarEvent;
}

export interface CalendarViewEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  classNames: string[];
  extendedProps: {
    importance: CalendarEvent['importance'];
    notes: string;
  };
}

export function getCalendarViewEvents(events: CalendarEvent[]): CalendarViewEvent[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.startsAt,
    end: event.endsAt,
    allDay: event.allDay,
    classNames: [`importance-${event.importance}`],
    extendedProps: {
      importance: event.importance,
      notes: event.notes
    }
  }));
}

export function getUpcomingItems(state: PlannerState, now = new Date(), range: UpcomingRange = state.settings.upcomingRange): PlannerListItem[] {
  const through = range === 'all' ? undefined : addDays(now, range === 'today' ? 1 : range === '7days' ? 7 : 30);
  return [...eventsToItems(state.events), ...tasksToItems(state.tasks)]
    .filter((item) => {
      const value = item.startsAt ?? item.dueAt;
      if (!value) return false;
      const date = parseISO(value);
      return !isBefore(date, now) && (!through || !isAfter(date, through));
    })
    .sort(compareItemsByTime);
}

export function getTodayItems(state: PlannerState, now = new Date()): PlannerListItem[] {
  return [...eventsToItems(state.events), ...tasksToItems(state.tasks)]
    .filter((item) => {
      const value = item.startsAt ?? item.dueAt;
      return value ? isSameDay(parseISO(value), now) : false;
    })
    .sort(compareItemsByTime);
}

export function getTaskListItems(
  state: PlannerState,
  filter: 'today' | 'upcoming' | 'overdue' | 'completed',
  now = new Date()
): PlannerListItem[] {
  const taskItems = tasksToItems(state.tasks).filter((item) => {
    if (filter === 'completed') return item.status === 'completed';
    if (item.status === 'completed') return false;
    if (filter === 'today') return Boolean(item.dueAt && isSameDay(parseISO(item.dueAt), now));
    if (filter === 'overdue') return Boolean(item.dueAt && isBefore(parseISO(item.dueAt), now));
    return true;
  });

  if (!state.settings.showCalendarEventsInTasks || filter === 'completed') {
    return taskItems.sort(compareItemsByTime);
  }

  const eventItems = eventsToItems(state.events).filter((item) => {
    if (!item.startsAt) return false;
    const startsAt = parseISO(item.startsAt);
    if (filter === 'today') return isSameDay(startsAt, now);
    if (filter === 'overdue') return isBefore(startsAt, now);
    return !isBefore(startsAt, now);
  });

  return [...taskItems, ...eventItems].sort(compareItemsByTime);
}

function tasksToItems(tasks: Task[]): PlannerListItem[] {
  return tasks.map((task) => ({
    id: task.id,
    kind: 'task',
    title: task.title,
    notes: task.notes,
    dueAt: task.dueAt,
    priority: task.priority,
    status: task.status,
    completed: task.status === 'completed',
    source: task
  }));
}

function eventsToItems(events: CalendarEvent[]): PlannerListItem[] {
  return events.map((event) => ({
    id: event.id,
    kind: 'event',
    title: event.title,
    notes: event.notes,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    importance: event.importance,
    completed: isEventOccurrenceCompleted(event),
    source: event
  }));
}

function compareItemsByTime(a: PlannerListItem, b: PlannerListItem): number {
  return (a.startsAt ?? a.dueAt ?? '').localeCompare(b.startsAt ?? b.dueAt ?? '');
}
