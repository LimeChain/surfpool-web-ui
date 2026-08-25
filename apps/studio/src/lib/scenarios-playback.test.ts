import { describe, expect, it, vi } from 'vitest';
import {
  beginPlaybackCleanup,
  dispatchAbsoluteSlotChange,
  isCurrentPlaybackStart,
  jsonRpcContextSlot,
  mergeOverrideOutcomes,
  nextScenarioSlotHeight,
  overrideIdForAction,
  parseOverrideOutcomeResponse,
  scenarioSlotInsertionHeight,
  scenarioStepHeight,
  scenarioTimelineStepPosition,
  skippedOverrideToast,
  validateScenarioSlotHeights,
  waitForPlaybackCleanup,
} from './scenarios-playback';

describe('jsonRpcContextSlot', () => {
  it('reads a safe slot from a JSON-RPC response', () => {
    expect(jsonRpcContextSlot({ result: { context: { slot: 439000871 } } })).toBe(439000871);
  });

  it('rejects missing and unsafe slots', () => {
    expect(jsonRpcContextSlot({ result: { context: {} } })).toBeNull();
    expect(jsonRpcContextSlot({ result: { context: { slot: Number.MAX_SAFE_INTEGER + 1 } } })).toBeNull();
  });
});

describe('dispatchAbsoluteSlotChange', () => {
  it('dispatches an absolute slot update for shared clock widgets', () => {
    const listener = vi.fn();
    window.addEventListener('epochChanged', listener);

    dispatchAbsoluteSlotChange(439000871);

    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ absoluteSlot: 439000871 });
    window.removeEventListener('epochChanged', listener);
  });
});

describe('waitForPlaybackCleanup', () => {
  it('does not release replacement playback before the previous cleanup finishes', async () => {
    let finishCleanup: ((result: boolean) => void) | undefined;
    const cleanup = new Promise<boolean>((resolve) => {
      finishCleanup = resolve;
    });
    beginPlaybackCleanup(function runCleanup() {
      return cleanup;
    });
    let released = false;
    const waiting = waitForPlaybackCleanup().then(function markReleased(result) {
      released = true;
      return result;
    });

    await Promise.resolve();
    expect(released).toBe(false);

    finishCleanup?.(true);
    await expect(waiting).resolves.toBe(true);
    expect(released).toBe(true);
  });

  it('allows playback immediately when no cleanup is pending', async () => {
    await expect(waitForPlaybackCleanup()).resolves.toBe(true);
  });

  it('keeps replacement playback blocked until cleanup succeeds', async () => {
    await expect(
      beginPlaybackCleanup(function failCleanup() {
        return Promise.resolve(false);
      })
    ).resolves.toBe(false);
    await expect(waitForPlaybackCleanup()).resolves.toBe(false);

    await expect(
      beginPlaybackCleanup(function retryCleanup() {
        return Promise.resolve(true);
      })
    ).resolves.toBe(true);
    await expect(waitForPlaybackCleanup()).resolves.toBe(true);
  });
});

describe('isCurrentPlaybackStart', () => {
  it('prevents an invalidated start from registering after an awaited request', async () => {
    let finishPause: (() => void) | undefined;
    const pause = new Promise<void>(function capturePause(resolve) {
      finishPause = resolve;
    });
    let currentGeneration = 1;
    const register = vi.fn();

    async function startPlayback() {
      const attemptGeneration = currentGeneration;
      await pause;
      if (!isCurrentPlaybackStart(currentGeneration, attemptGeneration)) return;
      register();
    }

    const start = startPlayback();
    currentGeneration += 1;
    finishPause?.();
    await start;

    expect(register).not.toHaveBeenCalled();
  });
});

describe('parseOverrideOutcomeResponse', () => {
  it('rejects a JSON-RPC error returned with HTTP 200', () => {
    expect(
      parseOverrideOutcomeResponse(
        { error: { code: -32602, message: 'Duplicate scenario override id' } },
        'Failed to register scenario'
      )
    ).toEqual({ ok: false, message: 'Duplicate scenario override id' });
  });

  it('rejects a missing outcomes array', () => {
    expect(
      parseOverrideOutcomeResponse({ result: { context: { slot: 10 }, value: null } }, 'Failed to register scenario')
    ).toEqual({ ok: false, message: 'Failed to register scenario' });
  });

  it('parses skipped outcomes and merges them by override id', () => {
    const parsed = parseOverrideOutcomeResponse(
      {
        result: {
          context: { slot: 10 },
          value: [{ overrideId: 'override-1', applied: false, reason: 'account not found' }],
        },
      },
      'Failed to register scenario'
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(mergeOverrideOutcomes({}, parsed.outcomes)).toEqual({
      'override-1': { applied: false, reason: 'account not found' },
    });
  });

  it('parses outcomes returned by time travel', () => {
    expect(
      parseOverrideOutcomeResponse(
        {
          result: {
            absoluteSlot: 30,
            overrideOutcomes: [{ overrideId: 'override-2', applied: true, reason: null }],
          },
        },
        'Failed to advance the scenario'
      )
    ).toEqual({
      ok: true,
      outcomes: [{ overrideId: 'override-2', applied: true, reason: null }],
      slot: 30,
    });
  });
});

describe('overrideIdForAction', () => {
  it('keeps duplicate actions in one slot distinct', () => {
    const action = { actionId: 'pyth-price' };
    expect(overrideIdForAction(action, 450, 0)).toBe('pyth-price_450_0');
    expect(overrideIdForAction(action, 450, 1)).toBe('pyth-price_450_1');
  });

  it('preserves an existing backend override id', () => {
    expect(overrideIdForAction({ actionId: 'pyth-price', overrideId: 'stable-id' }, 450, 0)).toBe('stable-id');
  });
});

describe('skippedOverrideToast', () => {
  it('returns one summary for every skipped override in a slot', () => {
    expect(
      skippedOverrideToast(
        [
          { overrideId: 'first', applied: false, reason: 'account not found' },
          { overrideId: 'second', applied: true },
          { overrideId: 'third', applied: false, reason: 'override is disabled' },
        ],
        450
      )
    ).toEqual({
      title: '2 overrides skipped at slot 450',
      description: 'account not found. +1 more',
    });
  });

  it('does not create a summary when every override was applied', () => {
    expect(skippedOverrideToast([{ overrideId: 'applied', applied: true }], 750)).toBeNull();
  });
});

describe('scenarioTimelineStepPosition', () => {
  it('aligns every playback marker with its slot label', () => {
    expect([0, 1, 2].map((stepIndex) => scenarioTimelineStepPosition(stepIndex, 3))).toEqual([
      12.5, 50, 87.5,
    ]);
  });

  it('centers a single scenario step', () => {
    expect(scenarioTimelineStepPosition(0, 1)).toBe(50);
  });
});

describe('sparse scenario slots', () => {
  const slots = [{ height: 0 }, { height: 450 }, { height: 750 }];

  it('preserves backend slot heights instead of replacing them with array indexes', () => {
    expect(slots.map((slot, index) => scenarioStepHeight(slot.height, index))).toEqual([0, 450, 750]);
  });

  it('appends after the maximum slot and does not reuse the array length', () => {
    expect(nextScenarioSlotHeight(slots)).toBe(751);
  });

  it('uses a free height for insertion and rejects adjacent slots', () => {
    expect(scenarioSlotInsertionHeight(slots, 1)).toBe(1);
    expect(scenarioSlotInsertionHeight([{ height: 450 }, { height: 451 }], 1)).toBeNull();
  });

  it('requires slot 0 and strictly increasing safe integer heights', () => {
    expect(validateScenarioSlotHeights(slots)).toBeNull();
    expect(validateScenarioSlotHeights([{ height: 450 }])).toBe('A scenario must start at slot 0');
    expect(validateScenarioSlotHeights([{ height: 0 }, { height: 0 }])).toContain('strictly increasing');
    expect(validateScenarioSlotHeights([{ height: 0 }, { height: 1.5 }])).toContain('safe integers');
  });
});
