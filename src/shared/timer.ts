import type { TimerMode } from './types';

export interface ActiveTimer {
  mode: TimerMode;
  startedAt: number;
  durationSeconds: number;
}

export interface TimerSnapshot {
  elapsedSeconds: number;
  remainingSeconds: number;
  progress: number;
  finishedAt: Date;
  isExpired: boolean;
}

export function getTimerSnapshot(activeTimer: ActiveTimer, nowMs = Date.now()): TimerSnapshot {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - activeTimer.startedAt) / 1000));
  const remainingSeconds = Math.max(0, activeTimer.durationSeconds - elapsedSeconds);
  const progress = activeTimer.durationSeconds === 0 ? 1 : Math.min(1, elapsedSeconds / activeTimer.durationSeconds);

  return {
    elapsedSeconds,
    remainingSeconds,
    progress,
    finishedAt: new Date(activeTimer.startedAt + activeTimer.durationSeconds * 1000),
    isExpired: remainingSeconds === 0
  };
}

export function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }

  return `${minutes}:${pad(remainingSeconds)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
