import { addDays, isAfter, isBefore, isSameDay, parseISO } from 'date-fns';
import type { CalendarEvent, PlannerState, Task, UpcomingRange } from './types';
import { isEventOccurrenceCompleted } from './events';
import { getTaskCompletionTime } from './tasks';
import { normalizeOccurrenceKey } from './date';

export type PlannerItemKind = 'task' | 'event';
export type PlannerFilter = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';
export type TaskListTab = 'all' | 'today' | 'upcoming' | 'overdue';

export interface PlannerListItem {
  id: string;
  kind: PlannerItemKind;
  title: string;
  notes: string;
  startsAt?: string;
  endsAt?: string;
  dueAt?: string;
  allDay?: boolean;
  priority?: Task['priority'];
  importance?: CalendarEvent['importance'];
  status?: Task['status'];
  completed: boolean;
  completedAt?: string;
  source: Task | CalendarEvent;
}

export interface PlannerListGroups {
  active: PlannerListItem[];
  completed: PlannerListItem[];
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
  backgroundColor: string;
  borderColor: string;
}

export function getCalendarViewEvents(events: CalendarEvent[]): CalendarViewEvent[] {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.startsAt,
    end: event.endsAt,
    allDay: event.allDay,
    classNames: [`importance-${event.importance}`],
    backgroundColor: event.color,
    borderColor: event.color,
    extendedProps: {
      importance: event.importance,
      notes: event.notes
    }
  }));
}

export function getUpcomingItems(state: PlannerState, now = new Date(), range: UpcomingRange = state.settings.upcomingRange): PlannerListItem[] {
  const through = range === 'all' ? undefined : addDays(now, range === 'today' ? 1 : range === '7days' ? 7 : 30);
  return [...eventsToItems(state.events), ...tasksToItems(state.tasks)]
    .filter((item) => !item.completed)
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
    .filter((item) => !item.completed)
    .filter((item) => {
      const value = item.startsAt ?? item.dueAt;
      return value ? isSameDay(parseISO(value), now) : false;
    })
    .sort(compareItemsByTime);
}

export function getTaskListItems(
  state: PlannerState,
  filter: PlannerFilter,
  now = new Date()
): PlannerListItem[] {
  const groups = getTaskListGroups(state, filter === 'completed' ? 'all' : filter, now);
  return filter === 'completed' ? groups.completed : groups.active;
}

export function getTaskListGroups(
  state: PlannerState,
  filter: PlannerFilter,
  now = new Date()
): PlannerListGroups {
  const tab = filter === 'completed' ? 'all' : filter;
  const taskItems = tasksToItems(state.tasks);
  const eventItems = state.settings.showCalendarEventsInTasks ? eventsToItems(state.events) : [];

  const active = [...taskItems, ...eventItems]
    .filter((item) => !item.completed && matchesTabFilter(item, tab, now))
    .sort(compareItemsByTime);

  const completed = [...taskItems, ...eventItems]
    .filter((item) => item.completed && matchesTabFilter(item, tab, now))
    .sort(compareItemsByCompletedTime);

  return { active, completed };
}

function tasksToItems(tasks: Task[]): PlannerListItem[] {
  return tasks.map((task) => ({
    id: task.id,
    kind: 'task',
    title: task.title,
    notes: task.notes,
    startsAt: task.startsAt,
    endsAt: task.endsAt ?? task.dueAt,
    dueAt: task.dueAt,
    allDay: task.allDay,
    priority: task.priority,
    status: task.status,
    completed: task.status === 'completed',
    completedAt: getTaskCompletionTime(task),
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
    allDay: event.allDay,
    importance: event.importance,
    completed: isEventOccurrenceCompleted(event),
    completedAt: event.completedOccurrences.find((record) => record.occurrenceKey === normalizeOccurrenceKey(event.startsAt))?.completedAt ?? event.completedOccurrences[0]?.completedAt,
    source: event
  }));
}

function compareItemsByTime(a: PlannerListItem, b: PlannerListItem): number {
  return (a.startsAt ?? a.endsAt ?? a.dueAt ?? '').localeCompare(b.startsAt ?? b.endsAt ?? b.dueAt ?? '');
}

function compareItemsByCompletedTime(a: PlannerListItem, b: PlannerListItem): number {
  return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
}

function matchesTabFilter(item: PlannerListItem, filter: TaskListTab, now: Date): boolean {
  if (filter === 'all') return true;
  const value = item.startsAt ?? item.endsAt ?? item.dueAt;
  if (!value) return false;
  const date = parseISO(value);
  if (filter === 'today') return isSameDay(date, now);
  if (filter === 'overdue') return isBefore(date, now);
  return !isBefore(date, now);
}
