import type { PlannerState } from '../shared/types';
import type { StoragePort } from './ports';
import { createDefaultState } from './defaultState';
import { normalizePlannerState } from '../shared/settings';

const key = 'productivity-codex-state-v1';

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
