import { RRule, Weekday, rrulestr } from 'rrule';
import type { RepeatFrequency } from './types';

export interface RecurrenceInput {
  frequency: RepeatFrequency;
  interval: number;
  count?: number;
  until?: Date;
  weekdays?: Array<'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'>;
  months?: number[];
}

export type RecurrenceDraft = Omit<RecurrenceInput, 'frequency'> & { frequency: RepeatFrequency | 'none' };

export function createRecurrenceRule(input: RecurrenceInput): string {
  const freq = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY
  }[input.frequency];

  return new RRule({
    freq,
    interval: Math.max(1, input.interval),
    count: input.count,
    until: input.until,
    byweekday: input.weekdays?.map(toWeekday),
    bymonth: input.frequency === 'monthly' && input.months && input.months.length > 0 ? input.months : undefined
  }).toString();
}

export function createCustomRecurrenceRule(input: RecurrenceInput): string | undefined {
  if (!input.frequency) {
    return undefined;
  }

  return createRecurrenceRule(input);
}

export function parseRecurrenceRule(rule: string | undefined): RecurrenceDraft {
  if (!rule) {
    return { frequency: 'none', interval: 1 };
  }

  const parsed = rrulestr(rule) as RRule;
  const options = parsed.options;
  const frequency = frequencyFromRRule(options.freq);
  return {
    frequency,
    interval: options.interval || 1,
    count: options.count || undefined,
    until: options.until ?? undefined,
    weekdays: options.byweekday?.map(fromWeekday).filter(Boolean) as RecurrenceInput['weekdays'],
    months: frequency === 'monthly' ? options.bymonth?.filter((month) => month >= 1 && month <= 12) : undefined
  };
}

function frequencyFromRRule(freq: number): RepeatFrequency {
  if (freq === RRule.WEEKLY) return 'weekly';
  if (freq === RRule.MONTHLY) return 'monthly';
  if (freq === RRule.YEARLY) return 'yearly';
  return 'daily';
}

function fromWeekday(day: number): 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU' | undefined {
  return ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][day] as 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU' | undefined;
}

export function expandOccurrences(start: Date, rule: string | undefined, from: Date, to: Date): Date[] {
  if (!rule) {
    return start >= from && start <= to ? [start] : [];
  }

  const parsed = rrulestr(rule, { dtstart: start });
  return parsed.between(from, to, true);
}

function toWeekday(day: 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'): Weekday {
  return {
    MO: RRule.MO,
    TU: RRule.TU,
    WE: RRule.WE,
    TH: RRule.TH,
    FR: RRule.FR,
    SA: RRule.SA,
    SU: RRule.SU
  }[day];
}

export function nextOccurrence(start: Date, rule: string | undefined, after: Date): Date | undefined {
  if (!rule) {
    return start > after ? start : undefined;
  }

  const parsed = rrulestr(rule, { dtstart: start });
  return parsed.after(after, false) ?? undefined;
}
