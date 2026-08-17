import type { Scenario } from '@/lib/scenarios-data';
import { reinsertScenario, rollbackScenarioUpdate } from '@/lib/scenarios-list-ops';
import { describe, expect, it } from 'vitest';

const s = (id: string): Scenario => ({ id, name: id });

describe('rollbackScenarioUpdate', () => {
  it('restores the previous scenario while preserving unrelated current items', () => {
    const previous = { ...s('a'), name: 'previous' };
    const optimistic = { ...previous, name: 'optimistic' };
    const concurrent = s('b');

    const result = rollbackScenarioUpdate([optimistic, concurrent], optimistic, previous);

    expect(result).toEqual([previous, concurrent]);
  });

  it('preserves a refreshed version of the same scenario', () => {
    const previous = { ...s('a'), name: 'previous' };
    const optimistic = { ...previous, name: 'optimistic' };
    const refreshed = { ...previous, name: 'refreshed' };
    const current = [refreshed, s('b')];

    expect(rollbackScenarioUpdate(current, optimistic, previous)).toBe(current);
    expect(current[0]).toBe(refreshed);
  });
});

describe('reinsertScenario', () => {
  it('restores the item at its original index when nothing else changed', () => {
    const a = s('a');
    const result = reinsertScenario([s('b')], a, 0);
    expect(result.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('preserves a concurrent create that landed while the delete was in flight', () => {
    // Deleted A from [A, B]; C was created concurrently, so current is [B, C].
    const a = s('a');
    const result = reinsertScenario([s('b'), s('c')], a, 0);
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not resurrect a scenario removed concurrently', () => {
    // Deleted A from [A, B]; B was also deleted concurrently, so current is [C].
    const a = s('a');
    const result = reinsertScenario([s('c')], a, 0);
    expect(result.map((x) => x.id)).toEqual(['a', 'c']);
    expect(result.some((x) => x.id === 'b')).toBe(false);
  });

  it('is a no-op if the item is already present', () => {
    const a = s('a');
    const current = [a, s('b')];
    expect(reinsertScenario(current, a, 0)).toBe(current);
  });

  it('preserves a newer version of the item after a failed delete', () => {
    const deleted = { ...s('a'), name: 'stale' };
    const current = [{ ...s('a'), name: 'updated' }, s('b')];

    expect(reinsertScenario(current, deleted, 0)).toBe(current);
    expect(current[0].name).toBe('updated');
  });

  it('clamps the index when the current list is shorter than the original', () => {
    const a = s('a');
    // Original index 3, but concurrent deletes shrank the list to one item.
    const result = reinsertScenario([s('c')], a, 3);
    expect(result.map((x) => x.id)).toEqual(['c', 'a']);
  });
});
