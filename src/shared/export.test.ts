import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../platform/defaultState';
import { buildPlannerExport, buildPlannerExportFilename, parsePlannerExport, plannerExportSchemaVersion } from './export';

describe('planner export', () => {
  it('wraps the full planner state in a versioned export envelope', () => {
    const state = createDefaultState();
    const exportedAt = new Date('2026-06-21T12:00:00.000Z');
    const file = buildPlannerExport(state, exportedAt);

    expect(file).toEqual({
      schemaVersion: plannerExportSchemaVersion,
      exportedAt: '2026-06-21T12:00:00.000Z',
      state
    });
  });

  it('uses the requested export file name format', () => {
    expect(buildPlannerExportFilename(new Date('2026-06-21T12:00:00.000Z'))).toBe('productivity-codex-export-2026-06-21.json');
  });

  it('parses and normalizes a valid planner export', () => {
    const state = createDefaultState();
    const parsed = parsePlannerExport({
      schemaVersion: plannerExportSchemaVersion,
      exportedAt: '2026-06-21T12:00:00.000Z',
      state: { ...state, settings: { notificationsEnabled: false } }
    });

    expect(parsed.settings.notificationsEnabled).toBe(false);
    expect(parsed.settings.showTaskItemsInTasks).toBe(true);
  });

  it('rejects invalid planner export files', () => {
    expect(() => parsePlannerExport({ schemaVersion: 999, state: {} })).toThrow('unsupported schema');
    expect(() => parsePlannerExport({ schemaVersion: plannerExportSchemaVersion })).toThrow('planner state');
  });
});
