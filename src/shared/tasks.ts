import { isAfter, parseISO } from 'date-fns';
import type { Task } from './types';
import { normalizeOccurrenceKey } from './date';
import { nextOccurrence } from './recurrence';

export function completeTaskOccurrence(task: Task, occurrenceAt = task.dueAt ?? new Date().toISOString()): Task {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  const completedOccurrences = Array.from(new Set([...task.completedOccurrences, occurrenceKey]));

  if (!task.recurrenceRule) {
    return {
      ...task,
      status: 'completed',
      completedOccurrences,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...task,
    status: 'open',
    completedOccurrences,
    updatedAt: new Date().toISOString()
  };
}

export function toggleTaskCompletion(task: Task, occurrenceAt = task.dueAt ?? new Date().toISOString()): Task {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  const isCompleted = task.completedOccurrences.includes(occurrenceKey) || task.status === 'completed';

  if (isCompleted) {
    return {
      ...task,
      status: 'open',
      completedOccurrences: task.completedOccurrences.filter((candidate) => candidate !== occurrenceKey),
      updatedAt: new Date().toISOString()
    };
  }

  return completeTaskOccurrence(task, occurrenceAt);
}

export function getNextTaskOccurrence(task: Task, after = new Date()): Date | undefined {
  if (!task.dueAt) {
    return undefined;
  }

  if (!task.recurrenceRule) {
    const due = parseISO(task.dueAt);
    return isAfter(due, after) ? due : undefined;
  }

  return nextOccurrence(parseISO(task.dueAt), task.recurrenceRule, after);
}

export function isTaskOccurrenceCompleted(task: Task, occurrenceAt: string): boolean {
  return task.completedOccurrences.includes(normalizeOccurrenceKey(occurrenceAt));
}
