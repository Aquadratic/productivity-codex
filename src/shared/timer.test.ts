import { describe, expect, it } from 'vitest';
import { formatTimer, getTimerSnapshot } from './timer';

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
  });
});
