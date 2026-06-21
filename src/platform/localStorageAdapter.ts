import type { PlannerState } from '../shared/types';
import type { StoragePort } from './ports';
import { createDefaultState } from './defaultState';
import { normalizePlannerState } from '../shared/settings';

// Temporary testing reset: bump this key during pre-approval update cycles.
const key = 'productivity-codex-state-v3-test';

export class LocalStorageAdapter implements StoragePort {
  async load(): Promise<PlannerState> {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return createDefaultState();
    }

    return normalizePlannerState(JSON.parse(raw));
  }

  async save(state: PlannerState): Promise<void> {
    localStorage.setItem(key, JSON.stringify(state));
  }
}
