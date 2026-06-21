import { addDays, addMilliseconds, differenceInMilliseconds, isAfter, isBefore, isSameDay, parseISO } from 'date-fns';
import type { CalendarEvent, PlannerState, Task, UpcomingRange } from './types';
import { isEventOccurrenceCompleted } from './events';
import { getTaskCompletionTime } from './tasks';
import { normalizeOccurrenceKey } from './date';
import { expandOccurrences } from './recurrence';

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
  color?: string;
  status?: Task['status'];
  completed: boolean;
  completedAt?: string;
  source: Task | CalendarEvent;
  occurrenceKey?: string;
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
    kind: PlannerItemKind;
    sourceId: string;
    occurrenceAt?: string;
  };
  backgroundColor: string;
  borderColor: string;
}

export function getCalendarViewEvents(
  stateOrEvents: PlannerState | CalendarEvent[],
  rangeStart?: Date,
  rangeEnd?: Date
): CalendarViewEvent[] {
  const state = Array.isArray(stateOrEvents) ? undefined : stateOrEvents;
  const events = Array.isArray(stateOrEvents) ? stateOrEvents : stateOrEvents.events;
  const settings = state?.settings;
  const showEvents = settings?.showEventsInCalendar ?? true;
  const showTasks = settings?.showTasksInCalendar ?? false;
  const from = rangeStart ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const to = rangeEnd ?? addDays(from, 60);

  return [
    ...(showEvents ? events.flatMap((event) => eventToCalendarEvents(event, from, to)) : []),
    ...(state && showTasks ? state.tasks.flatMap((task) => taskToCalendarEvents(task, from, to)) : [])
  ];
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
  return tasks.flatMap((task) => {
    const active: PlannerListItem[] = task.status === 'completed'
      ? []
      : [{
    id: task.id,
    kind: 'task' as const,
    title: task.title,
    notes: task.notes,
    startsAt: task.startsAt,
    endsAt: task.endsAt ?? task.dueAt,
    dueAt: task.dueAt,
    allDay: task.allDay,
    priority: task.priority,
    color: task.color,
    status: task.status,
    completed: false,
    completedAt: getTaskCompletionTime(task),
    source: task
      }];
    const completed: PlannerListItem[] = task.completedOccurrences.map((record) => ({
      id: `${task.id}:${record.occurrenceKey}`,
      kind: 'task' as const,
      title: task.title,
      notes: task.notes,
      startsAt: undefined,
      endsAt: record.occurrenceKey,
      dueAt: record.occurrenceKey,
      allDay: task.allDay,
      priority: task.priority,
      color: task.color,
      status: 'completed' as const,
      completed: true,
      completedAt: record.completedAt,
      occurrenceKey: record.occurrenceKey,
      source: task
    }));
    return [...active, ...completed];
  });
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
    color: event.color,
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

function eventToCalendarEvents(event: CalendarEvent, from: Date, to: Date): CalendarViewEvent[] {
  const startsAt = parseISO(event.startsAt);
  const endsAt = parseISO(event.endsAt);
  const duration = differenceInMilliseconds(endsAt, startsAt);
  return expandOccurrences(startsAt, event.recurrenceRule, from, to).map((occurrence) => ({
    id: `event:${event.id}:${occurrence.toISOString()}`,
    title: event.title,
    start: occurrence.toISOString(),
    end: addMilliseconds(occurrence, duration).toISOString(),
    allDay: event.allDay,
    classNames: [`importance-${event.importance}`],
    backgroundColor: event.color,
    borderColor: event.color,
    extendedProps: {
      importance: event.importance,
      notes: event.notes,
      kind: 'event',
      sourceId: event.id,
      occurrenceAt: occurrence.toISOString()
    }
  }));
}

function taskToCalendarEvents(task: Task, from: Date, to: Date): CalendarViewEvent[] {
  if (task.status === 'completed' || !task.endsAt) {
    return [];
  }

  const endsAt = parseISO(task.endsAt);
  const startsAt = task.startsAt ? parseISO(task.startsAt) : endsAt;
  const duration = Math.max(0, differenceInMilliseconds(endsAt, startsAt));
  return expandOccurrences(endsAt, task.recurrenceRule, from, to).map((occurrence) => ({
    id: `task:${task.id}:${occurrence.toISOString()}`,
    title: task.title,
    start: task.startsAt ? addMilliseconds(occurrence, -duration).toISOString() : occurrence.toISOString(),
    end: occurrence.toISOString(),
    allDay: task.allDay,
    classNames: [`task-calendar-event`, `importance-${task.priority}`],
    backgroundColor: task.color ?? '#23693c',
    borderColor: task.color ?? '#23693c',
    extendedProps: {
      importance: task.priority,
      notes: task.notes,
      kind: 'task',
      sourceId: task.id,
      occurrenceAt: occurrence.toISOString()
    }
  }));
}
