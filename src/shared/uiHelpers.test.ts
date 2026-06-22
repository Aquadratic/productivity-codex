import { describe, expect, it } from 'vitest';
import { defaultSettings } from './types';
import { buildThemeVariables, calendarClickRange, wrapMinute } from './uiHelpers';

describe('ui helpers', () => {
  it('wraps minute spinner values without changing the hour', () => {
    expect(wrapMinute(59)).toBe('59');
    expect(wrapMinute(60)).toBe('00');
    expect(wrapMinute(-1)).toBe('59');
  });

  it('maps calendar box and line clicks to expected ranges', () => {
    const clicked = new Date('2026-06-21T14:20:00');
    const box = calendarClickRange(clicked, false);
    const line = calendarClickRange(clicked, true);

    expect(box.start.toISOString()).toBe(new Date('2026-06-21T14:00:00').toISOString());
    expect(box.end.toISOString()).toBe(new Date('2026-06-21T15:00:00').toISOString());
    expect(line.start.toISOString()).toBe(new Date('2026-06-21T13:30:00').toISOString());
    expect(line.end.toISOString()).toBe(new Date('2026-06-21T14:30:00').toISOString());
  });

  it('builds theme CSS variables from presets and custom colors', () => {
    expect(buildThemeVariables(defaultSettings)['--color-accent']).toBe('#2f5597');
    expect(buildThemeVariables({
      ...defaultSettings,
      themePreset: 'custom',
      themeColors: { ...defaultSettings.themeColors, accent: '#123456' }
    })['--color-accent']).toBe('#123456');
    expect(buildThemeVariables(defaultSettings)['--color-text']).toBe('#111827');
    expect(buildThemeVariables({ ...defaultSettings, themePreset: 'dark' })['--color-text']).toBe('#f8fafc');
  });
});
