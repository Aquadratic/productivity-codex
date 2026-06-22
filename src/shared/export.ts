import { format } from 'date-fns';
import type { PlannerState } from './types';

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
