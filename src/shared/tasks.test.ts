import { describe, expect, it } from 'vitest';
import { createRecurrenceRule } from './recurrence';
import { advanceOverdueRecurringTasks, completeTaskOccurrence, getTaskCompletionTime, isTaskOccurrenceCompleted, toggleTaskCompletion } from './tasks';
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
    expect(recurring.dueAt).toBe('2026-06-21T14:00:00.000Z');
  });

  it('undoes a recurring completed occurrence by restoring it as active', () => {
    const recurring = completeTaskOccurrence(
      task({
        startsAt: '2026-06-20T13:00:00.000Z',
        endsAt: '2026-06-20T14:00:00.000Z',
        recurrenceRule: createRecurrenceRule({ frequency: 'daily', interval: 1 })
      }),
      '2026-06-20T14:00:00.000Z'
    );
    const restored = toggleTaskCompletion(recurring, '2026-06-20T14:00:00.000Z');

    expect(restored.status).toBe('open');
    expect(restored.completedOccurrences).toEqual([]);
    expect(restored.startsAt).toBe('2026-06-20T13:00:00.000Z');
    expect(restored.endsAt).toBe('2026-06-20T14:00:00.000Z');
    expect(restored.dueAt).toBe('2026-06-20T14:00:00.000Z');
  });

  it('advances overdue recurring tasks without completion records', () => {
    const [advanced] = advanceOverdueRecurringTasks([
      task({ recurrenceRule: createRecurrenceRule({ frequency: 'daily', interval: 1 }) })
    ], new Date('2026-06-22T09:00:00.000Z'));

    expect(advanced.dueAt).toBe('2026-06-22T14:00:00.000Z');
    expect(advanced.completedOccurrences).toEqual([]);
  });
});
