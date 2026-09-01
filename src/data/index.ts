import type { DataLayer } from './DataLayer';
import { createSeededMockDataLayer } from './mock/seed';

/**
 * The app gets its DataLayer from here and nowhere else. Phase 2 swaps this
 * factory for one that returns the server-backed implementation; no screen
 * imports anything from `./mock` directly.
 */

let instance: Promise<DataLayer> | null = null;

export function getDataLayer(): Promise<DataLayer> {
  if (!instance) instance = createSeededMockDataLayer();
  return instance;
}

export type {
  AllocationPlanView,
  Claim,
  CreateReleaseInput,
  CreateReleaseResult,
  DataLayer,
  IntakeInput,
  SendDetailView,
  SendPatch,
} from './DataLayer';
