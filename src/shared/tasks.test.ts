import { describe, expect, it } from 'vitest';
import { createRecurrenceRule } from './recurrence';
import { completeTaskOccurrence, getTaskCompletionTime, isTaskOccurrenceCompleted, toggleTaskCompletion } from './tasks';
import type { Task } from './types';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_1',
    title: 'Complete homework',
    notes: '',
    status: 'open',
    priority: 'normal',
    allDay: false,
    dueAt: '2026-06-20T14:00:00.000Z',
    reminders: [],
    completedOccurrences: [],
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
    ...overrides
  };
}

describe('tasks', () => {
  it('completes one-time tasks', () => {
    expect(completeTaskOccurrence(task()).status).toBe('completed');
  });

  it('toggles completed tasks back open', () => {
    const completed = toggleTaskCompletion(task(), '2026-06-20T14:00:00.000Z');
    const reopened = toggleTaskCompletion(completed, '2026-06-20T14:00:00.000Z');

    expect(completed.status).toBe('completed');
    expect(completed.completedOccurrences[0].completedAt).toBeTruthy();
    expect(getTaskCompletionTime(completed, '2026-06-20T14:00:00.000Z')).toBeTruthy();
    expect(reopened.status).toBe('open');
    expect(reopened.completedOccurrences).toEqual([]);
  });

  it('keeps recurring tasks open and records completed occurrence', () => {
    const recurring = completeTaskOccurrence(
      task({ recurrenceRule: createRecurrenceRule({ frequency: 'daily', interval: 1 }) }),
      '2026-06-20T14:00:00.000Z'
    );

    expect(recurring.status).toBe('open');
    expect(isTaskOccurrenceCompleted(recurring, '2026-06-20T14:00:00.000Z')).toBe(true);
  });
});
