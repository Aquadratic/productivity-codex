import { describe, expect, it } from 'vitest';
import { getCalendarViewEvents, getTaskListGroups, getTaskListItems, getUpcomingItems } from './selectors';
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
        importance: 'high',
        color: '#5578a6',
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
        allDay: false,
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

  it('shows or hides task records in the task list', () => {
    expect(
      getTaskListItems(
        state({ settings: { ...defaultSettings, showTaskItemsInTasks: false } }),
        'today',
        new Date('2026-06-20T13:00:00.000Z')
      ).map((item) => item.kind)
    ).toEqual(['event']);
  });

  it('moves completed tasks and events into completed sorted by completion time', () => {
    const completed = state({
      events: [
        {
          ...state().events[0],
          completedOccurrences: [{ occurrenceKey: '2026-06-20T15:00:00.000Z', completedAt: '2026-06-20T18:00:00.000Z' }]
        }
      ],
      tasks: [
        {
          ...state().tasks[0],
          status: 'completed',
          completedOccurrences: [{ occurrenceKey: '2026-06-20T14:00:00.000Z', completedAt: '2026-06-20T19:00:00.000Z' }]
        }
      ]
    });

    expect(getTaskListItems(completed, 'today', new Date('2026-06-20T13:00:00.000Z'))).toHaveLength(0);
    expect(getTaskListItems(completed, 'completed', new Date('2026-06-20T13:00:00.000Z')).map((item) => item.title)).toEqual([
      'Homework',
      'Class'
    ]);
  });

  it('groups task tabs into active and completed buckets', () => {
    const grouped = getTaskListGroups(
      state({
        tasks: [
          ...state().tasks,
          {
            ...state().tasks[0],
            id: 'task_2',
            title: 'Done later',
            status: 'completed',
            startsAt: '2026-06-21T14:00:00.000Z',
            endsAt: '2026-06-21T15:00:00.000Z',
            dueAt: undefined,
            completedOccurrences: [{ occurrenceKey: '2026-06-21T15:00:00.000Z', completedAt: '2026-06-20T19:00:00.000Z' }]
          },
          {
            ...state().tasks[0],
            id: 'task_3',
            title: 'Unscheduled',
            dueAt: undefined
          }
        ]
      }),
      'upcoming',
      new Date('2026-06-20T13:00:00.000Z')
    );

    expect(grouped.active.map((item) => item.title)).toEqual(['Homework', 'Class']);
    expect(grouped.completed.map((item) => item.title)).toEqual(['Done later']);
  });

  it('maps tasks and recurring events into calendar items based on visibility settings', () => {
    const calendarState = state({
      events: [{
        ...state().events[0],
        recurrenceRule: 'RRULE:FREQ=DAILY;COUNT=2'
      }],
      tasks: [{
        ...state().tasks[0],
        startsAt: '2026-06-20T13:30:00.000Z',
        endsAt: '2026-06-20T14:00:00.000Z'
      }]
    });

    expect(getCalendarViewEvents(calendarState, new Date('2026-06-20T00:00:00.000Z'), new Date('2026-06-22T00:00:00.000Z')).map((item) => item.extendedProps.kind)).toEqual([
      'event',
      'event',
      'task'
    ]);

    expect(getCalendarViewEvents({
      ...calendarState,
      settings: { ...defaultSettings, showEventsInCalendar: false, showTasksInCalendar: true }
    }, new Date('2026-06-20T00:00:00.000Z'), new Date('2026-06-22T00:00:00.000Z')).map((item) => item.extendedProps.kind)).toEqual(['task']);
  });
});
