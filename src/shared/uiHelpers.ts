import { addMinutes, setMinutes, setSeconds } from 'date-fns';
import { darkThemeColors, lightThemeColors, type AppSettings, type ThemeColors } from './types';

export function wrapMinute(value: number): string {
  const wrapped = ((Math.round(value) % 60) + 60) % 60;
  return String(wrapped).padStart(2, '0');
}

export function buildThemeVariables(settings: AppSettings): Record<string, string> {
  const colors = resolveThemeColors(settings);
  return {
    '--color-sidebar': colors.sidebar,
    '--color-page': colors.pageBackground,
    '--color-panel': colors.panelBackground,
    '--color-accent': colors.accent,
    '--color-task': colors.taskDefault,
    '--color-event': colors.eventDefault
  };
}

export function resolveThemeColors(settings: AppSettings): ThemeColors {
  if (settings.themePreset === 'dark') return darkThemeColors;
  if (settings.themePreset === 'light') return lightThemeColors;
  return settings.themeColors;
}

export function calendarClickRange(date: Date, isLineClick: boolean): { start: Date; end: Date } {
  const hourStart = setSeconds(setMinutes(date, 0), 0);
  return isLineClick
    ? { start: addMinutes(hourStart, -30), end: addMinutes(hourStart, 30) }
    : { start: hourStart, end: addMinutes(hourStart, 60) };
}
