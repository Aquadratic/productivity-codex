import { format } from 'date-fns';
import type { PlannerState } from './types';
import { normalizePlannerState } from './settings';

export const plannerExportSchemaVersion = 1;

export interface PlannerExportFile {
  schemaVersion: number;
  exportedAt: string;
  state: PlannerState;
}

export function buildPlannerExport(state: PlannerState, exportedAt = new Date()): PlannerExportFile {
  return {
    schemaVersion: plannerExportSchemaVersion,
    exportedAt: exportedAt.toISOString(),
    state
  };
}

export function buildPlannerExportFilename(exportedAt = new Date()): string {
  return `productivity-codex-export-${format(exportedAt, 'yyyy-MM-dd')}.json`;
}

export function parsePlannerExport(value: unknown): PlannerState {
  if (!value || typeof value !== 'object') {
    throw new Error('Import file is not a planner export.');
  }

  const file = value as Partial<PlannerExportFile>;
  if (file.schemaVersion !== plannerExportSchemaVersion) {
    throw new Error('Import file uses an unsupported schema version.');
  }

  if (!file.state || typeof file.state !== 'object') {
    throw new Error('Import file does not contain planner state.');
  }

  return normalizePlannerState(file.state);
}
