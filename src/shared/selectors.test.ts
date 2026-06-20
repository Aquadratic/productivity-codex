import { describe, expect, it } from 'vitest';
import { getTaskListItems, getUpcomingItems } from './selectors';
import { defaultSettings, type PlannerState } from './types';

function state(overrides: Partial<PlannerState> = {}): PlannerState {
  return {
    events: [
      {
        id: 'event_1',
        title: 'Class',
        notes: '',
        startsAt: '2026-06-20T15:00:00.000Z',
        endsAt: '2026-06-20T16:00:00.000Z',
        allDay: false,
        importance: 'important',
        reminders: [],
        completedOccurrences: [],
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z'
      }
    ],
    tasks: [
      {
        id: 'task_1',
        title: 'Homework',
        notes: '',
        status: 'open',
        priority: 'high',
        dueAt: '2026-06-20T14:00:00.000Z',
        reminders: [],
        completedOccurrences: [],
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z'
      }
    ],
    timerSessions: [],
    reminders: [],
    settings: defaultSettings,
    ...overrides
  };
}

describe('selectors', () => {
  it('returns upcoming tasks and events in time order', () => {
    const items = getUpcomingItems(state(), new Date('2026-06-20T13:00:00.000Z'));

    expect(items.map((item) => item.title)).toEqual(['Homework', 'Class']);
  });

  it('supports upcoming range filters', () => {
    const future = state({
      events: [
        {
          ...state().events[0],
          id: 'event_2',
          title: 'Far future',
          startsAt: '2026-08-01T15:00:00.000Z',
          endsAt: '2026-08-01T16:00:00.000Z'
        }
      ],
      tasks: []
    });

    expect(getUpcomingItems(future, new Date('2026-06-20T13:00:00.000Z'), '30days')).toHaveLength(0);
    expect(getUpcomingItems(future, new Date('2026-06-20T13:00:00.000Z'), 'all')).toHaveLength(1);
  });

  it('shows or hides calendar events in the task list', () => {
    expect(getTaskListItems(state(), 'today', new Date('2026-06-20T13:00:00.000Z')).map((item) => item.kind)).toEqual([
      'task',
      'event'
    ]);

    expect(
      getTaskListItems(
        state({ settings: { ...defaultSettings, showCalendarEventsInTasks: false } }),
        'today',
        new Date('2026-06-20T13:00:00.000Z')
      ).map((item) => item.kind)
    ).toEqual(['task']);
  });
});
