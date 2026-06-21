import { isAfter, parseISO } from 'date-fns';
import type { Task } from './types';
import { normalizeOccurrenceKey } from './date';
import { nextOccurrence } from './recurrence';

export function completeTaskOccurrence(task: Task, occurrenceAt = task.dueAt ?? new Date().toISOString()): Task {
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

  return {
    ...task,
    status: 'open',
    completedOccurrences,
    updatedAt: new Date().toISOString()
  };
}

export function toggleTaskCompletion(task: Task, occurrenceAt = task.dueAt ?? new Date().toISOString()): Task {
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
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  return task.completedOccurrences.some((record) => record.occurrenceKey === occurrenceKey);
}

export function getTaskCompletionTime(task: Task, occurrenceAt = task.dueAt ?? task.updatedAt): string | undefined {
  const occurrenceKey = normalizeOccurrenceKey(occurrenceAt);
  return task.completedOccurrences.find((record) => record.occurrenceKey === occurrenceKey)?.completedAt;
}
