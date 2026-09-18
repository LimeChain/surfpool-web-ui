import type { Scenario } from '@/lib/scenarios-data';

// Reinsert a scenario that was optimistically removed back into the *current*
// list. The list may have changed while the delete request was in flight (a
// create or another delete landed), so we operate on the current array rather
// than a stale snapshot: concurrent additions survive and a concurrently
// removed item is not resurrected. The item is placed back at its original
// index, clamped to the current length.
export function reinsertScenario(current: Scenario[], scenario: Scenario, index: number): Scenario[] {
  if (current.some((s) => s.id === scenario.id)) return current;
  const at = Math.max(0, Math.min(index, current.length));
  return [...current.slice(0, at), scenario, ...current.slice(at)];
}
