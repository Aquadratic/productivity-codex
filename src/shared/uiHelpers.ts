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
    '--color-event': colors.eventDefault,
    '--color-text': colors.textPrimary,
    '--color-muted': colors.textMuted,
    '--color-on-accent': colors.textOnAccent
  };
}

export function resolveThemeColors(settings: AppSettings): ThemeColors {
  if (settings.themePreset === 'dark') return darkThemeColors;
  if (settings.themePreset === 'light') return lightThemeColors;
  return deriveCustomThemeColors(settings.themeColors);
}

export function calendarClickRange(date: Date, isLineClick: boolean): { start: Date; end: Date } {
  const hourStart = setSeconds(setMinutes(date, 0), 0);
  return isLineClick
    ? { start: addMinutes(hourStart, -30), end: addMinutes(hourStart, 30) }
    : { start: hourStart, end: addMinutes(hourStart, 60) };
}

export function deriveCustomThemeColors(input: ThemeColors): ThemeColors {
  const accent = input.accent || lightThemeColors.accent;
  return {
    sidebar: darkenHex(accent, 0.34),
    pageBackground: mixHex('#ffffff', accent, 0.08),
    panelBackground: mixHex('#ffffff', accent, 0.02),
    accent,
    taskDefault: input.taskDefault || accent,
    eventDefault: input.eventDefault || accent,
    textPrimary: input.textPrimary || lightThemeColors.textPrimary,
    textMuted: input.textMuted || lightThemeColors.textMuted,
    textOnAccent: input.textOnAccent || lightThemeColors.textOnAccent
  };
}

function darkenHex(hex: string, amount: number): string {
  return mixHex('#000000', hex, Math.max(0, Math.min(1, amount)));
}

function mixHex(base: string, color: string, amount: number): string {
  const baseRgb = parseHex(base);
  const colorRgb = parseHex(color);
  const ratio = Math.max(0, Math.min(1, amount));
  return `#${baseRgb.map((channel, index) => {
    const mixed = Math.round(channel * (1 - ratio) + colorRgb[index] * ratio);
    return mixed.toString(16).padStart(2, '0');
  }).join('')}`;
}

function parseHex(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : lightThemeColors.accent.slice(1);
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
