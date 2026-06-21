import { describe, expect, it } from 'vitest';
import { durationPartsToSeconds, formatTimer, getTimerSnapshot, isValidTimerDuration } from './timer';

describe('timer', () => {
  it('calculates live timer progress', () => {
    const snapshot = getTimerSnapshot({ mode: 'focus', startedAt: 1000, durationSeconds: 60 }, 31_000);

    expect(snapshot.elapsedSeconds).toBe(30);
    expect(snapshot.remainingSeconds).toBe(30);
    expect(snapshot.progress).toBe(0.5);
    expect(snapshot.isExpired).toBe(false);
  });

  it('marks expired timers', () => {
    expect(getTimerSnapshot({ mode: 'break', startedAt: 1000, durationSeconds: 10 }, 12_000).isExpired).toBe(true);
  });

  it('formats timer values', () => {
    expect(formatTimer(65)).toBe('1:05');
    expect(formatTimer(3661)).toBe('1:01:01');
    expect(formatTimer(1.9)).toBe('0:01');
  });

  it('converts precise duration parts to seconds', () => {
    expect(durationPartsToSeconds({ hours: 1, minutes: 2, seconds: 3 })).toBe(3723);
    expect(isValidTimerDuration({ hours: 0, minutes: 0, seconds: 0 })).toBe(false);
    expect(isValidTimerDuration({ hours: 0, minutes: 0, seconds: 1 })).toBe(true);
  });
});
