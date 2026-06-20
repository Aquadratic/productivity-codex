import type { PlannerState } from '../shared/types';
import { defaultSettings } from '../shared/types';
import { normalizePlannerState } from '../shared/settings';

export function createDefaultState(): PlannerState {
  return normalizePlannerState({
    events: [],
    tasks: [],
    timerSessions: [],
    reminders: [],
    settings: defaultSettings
  });
}
