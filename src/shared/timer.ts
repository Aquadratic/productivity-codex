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

export interface TimerDurationParts {
  hours: number;
  minutes: number;
  seconds: number;
}

export function durationPartsToSeconds(parts: TimerDurationParts): number {
  return Math.max(0, Math.floor(parts.hours)) * 3600
    + Math.max(0, Math.floor(parts.minutes)) * 60
    + Math.max(0, Math.floor(parts.seconds));
}

export function secondsToDurationParts(seconds: number): TimerDurationParts {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return {
    hours: Math.floor(safeSeconds / 3600),
    minutes: Math.floor((safeSeconds % 3600) / 60),
    seconds: safeSeconds % 60
  };
}

export function isValidTimerDuration(parts: TimerDurationParts): boolean {
  return durationPartsToSeconds(parts) > 0;
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
  const safeSeconds = Math.max(0, Math.floor(seconds));
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
