import { describe, expect, it } from 'vitest';
import { buildTaskReminders, getMissedReminders } from './reminders';
import type { Task } from './types';

describe('reminders', () => {
  it('creates task reminders from due time and offsets', () => {
    const task: Task = {
      id: 'task_1',
      title: 'Take medication',
      notes: '',
      status: 'open',
      priority: 'high',
      dueAt: '2026-06-20T14:00:00.000Z',
      reminders: [{ minutesBefore: 30 }],
      completedOccurrences: [],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-20T00:00:00.000Z'
    };

    expect(buildTaskReminders(task)[0].triggerAt).toBe('2026-06-20T13:30:00.000Z');
  });

  it('returns missed reminders within the startup window', () => {
    const missed = getMissedReminders(
      [
        {
          id: 'rem_1',
          targetType: 'task',
          targetId: 'task_1',
          title: 'Homework',
          triggerAt: '2026-06-20T13:30:00.000Z'
        }
      ],
      new Date('2026-06-20T14:00:00.000Z')
    );

    expect(missed).toHaveLength(1);
  });
});
