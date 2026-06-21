import { addMilliseconds, differenceInMilliseconds, isAfter, parseISO } from 'date-fns';
import type { Task } from './types';
import { normalizeOccurrenceKey } from './date';
import { nextOccurrence } from './recurrence';

export function completeTaskOccurrence(task: Task, occurrenceAt = task.endsAt ?? task.dueAt ?? new Date().toISOString()): Task {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  const existing = task.completedOccurrences.some((record) => record.occurrenceKey === occurrenceKey);
  const completedOccurrences = existing
    ? task.completedOccurrences
    : [...task.completedOccurrences, { occurrenceKey, completedAt: new Date().toISOString() }];

  if (!task.recurrenceRule) {
    return {
      ...task,
      status: 'completed',
      completedOccurrences,
      updatedAt: new Date().toISOString()
    };
  }

  const advancedTask = advanceRecurringTask(task, parseISO(occurrenceKey), true);

  return {
    ...advancedTask,
    completedOccurrences,
    updatedAt: new Date().toISOString()
  };
}

export function advanceRecurringTask(task: Task, after = new Date(), includeAfter = false): Task {
  const endsAtValue = task.endsAt ?? task.dueAt;
  if (!task.recurrenceRule || !endsAtValue) {
    return task;
  }

  const endsAt = parseISO(endsAtValue);
  const next = nextOccurrence(endsAt, task.recurrenceRule, after);
  if (!next || (!includeAfter && !isAfter(next, endsAt))) {
    return task;
  }

  const duration = task.startsAt
    ? differenceInMilliseconds(endsAt, parseISO(task.startsAt))
    : 0;

  return {
    ...task,
    status: 'open',
    startsAt: task.startsAt ? addMilliseconds(next, -duration).toISOString() : undefined,
    endsAt: next.toISOString(),
    dueAt: next.toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function advanceOverdueRecurringTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks.map((task) => {
    const endsAt = task.endsAt ?? task.dueAt;
    if (!task.recurrenceRule || !endsAt || isAfter(parseISO(endsAt), now)) {
      return task;
    }

    return advanceRecurringTask(task, now);
  });
}

export function toggleTaskCompletion(task: Task, occurrenceAt = task.endsAt ?? task.dueAt ?? new Date().toISOString()): Task {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  const isCompleted = task.completedOccurrences.some((record) => record.occurrenceKey === occurrenceKey) || task.status === 'completed';

  if (isCompleted) {
    return {
      ...task,
      status: 'open',
      completedOccurrences: task.completedOccurrences.filter((candidate) => candidate.occurrenceKey !== occurrenceKey),
      updatedAt: new Date().toISOString()
    };
  }

  return completeTaskOccurrence(task, occurrenceAt);
}

export function getNextTaskOccurrence(task: Task, after = new Date()): Date | undefined {
  const endsAt = task.endsAt ?? task.dueAt;
  if (!endsAt) {
    return undefined;
  }

  if (!task.recurrenceRule) {
    const due = parseISO(endsAt);
    return isAfter(due, after) ? due : undefined;
  }

  return nextOccurrence(parseISO(endsAt), task.recurrenceRule, after);
}

export function isTaskOccurrenceCompleted(task: Task, occurrenceAt: string): boolean {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  return task.completedOccurrences.some((record) => record.occurrenceKey === occurrenceKey);
}

export function getTaskCompletionTime(task: Task, occurrenceAt = task.endsAt ?? task.dueAt ?? task.updatedAt): string | undefined {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  return task.completedOccurrences.find((record) => record.occurrenceKey === occurrenceKey)?.completedAt;
}
