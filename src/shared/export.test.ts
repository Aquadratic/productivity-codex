import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../platform/defaultState';
import { buildPlannerExport, buildPlannerExportFilename, plannerExportSchemaVersion } from './export';

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
});
