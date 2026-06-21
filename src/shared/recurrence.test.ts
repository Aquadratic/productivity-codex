import { describe, expect, it } from 'vitest';
import { createCustomRecurrenceRule, createRecurrenceRule, expandOccurrences } from './recurrence';

describe('recurrence', () => {
  it('expands daily recurrence', () => {
    const rule = createRecurrenceRule({ frequency: 'daily', interval: 1, count: 3 });
    const occurrences = expandOccurrences(
      new Date('2026-06-01T09:00:00.000Z'),
      rule,
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-05T00:00:00.000Z')
    );

    expect(occurrences).toHaveLength(3);
  });

  it('expands weekly recurrence', () => {
    const rule = createRecurrenceRule({ frequency: 'weekly', interval: 1, count: 2 });
    const occurrences = expandOccurrences(
      new Date('2026-06-01T09:00:00.000Z'),
      rule,
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-15T00:00:00.000Z')
    );

    expect(occurrences.map((date) => date.toISOString())).toEqual([
      '2026-06-01T09:00:00.000Z',
      '2026-06-08T09:00:00.000Z'
    ]);
  });

  it('expands monthly custom interval recurrence until a date', () => {
    const rule = createRecurrenceRule({
      frequency: 'monthly',
      interval: 2,
      until: new Date('2026-12-31T23:59:59.000Z')
    });
    const occurrences = expandOccurrences(
      new Date('2026-02-10T09:00:00.000Z'),
      rule,
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-12-31T23:59:59.000Z')
    );

    expect(occurrences.map((date) => date.toISOString())).toEqual([
      '2026-02-10T09:00:00.000Z',
      '2026-04-10T09:00:00.000Z',
      '2026-06-10T09:00:00.000Z',
      '2026-08-10T09:00:00.000Z',
      '2026-10-10T09:00:00.000Z',
      '2026-12-10T09:00:00.000Z'
    ]);
  });

  it('builds weekly custom weekday recurrence with count', () => {
    const rule = createCustomRecurrenceRule({
      frequency: 'weekly',
      interval: 2,
      count: 4,
      weekdays: ['MO', 'WE']
    });

    expect(rule).toContain('FREQ=WEEKLY');
    expect(rule).toContain('INTERVAL=2');
    expect(rule).toContain('COUNT=4');
    expect(rule).toContain('BYDAY=MO,WE');
  });

  it('builds daily weekday recurrence', () => {
    const rule = createCustomRecurrenceRule({
      frequency: 'daily',
      interval: 1,
      weekdays: ['MO', 'TU', 'WE', 'TH', 'FR']
    });

    expect(rule).toContain('FREQ=DAILY');
    expect(rule).toContain('BYDAY=MO,TU,WE,TH,FR');
  });

  it('builds monthly selected-month recurrence', () => {
    const rule = createCustomRecurrenceRule({
      frequency: 'monthly',
      interval: 1,
      months: [1, 6, 12]
    });

    expect(rule).toContain('FREQ=MONTHLY');
    expect(rule).toContain('BYMONTH=1,6,12');
  });

  it('builds yearly recurrence with optional until', () => {
    const rule = createCustomRecurrenceRule({
      frequency: 'yearly',
      interval: 1,
      until: new Date('2028-12-31T23:59:59.000Z')
    });

    expect(rule).toContain('FREQ=YEARLY');
    expect(rule).toContain('UNTIL=20281231T235959Z');
  });
});
