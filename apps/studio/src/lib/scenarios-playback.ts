export type OverrideOutcome = {
  overrideId: string;
  applied: boolean;
  reason?: string | null;
};

export type OverrideOutcomeState = Record<string, { applied: boolean; reason?: string }>;

export const SCENARIO_PLAYBACK_OUTCOME_TOAST_ID = 'scenario-playback-outcome';

type SkippedOverrideToast = {
  title: string;
  description?: string;
};

type ScenarioActionIdentity = {
  overrideId?: string;
  actionId: string;
};

type ParsedOverrideOutcomeResponse =
  | { ok: true; outcomes: OverrideOutcome[]; slot: number }
  | { ok: false; message: string };

let pendingPlaybackCleanup: Promise<boolean> | null = null;
let playbackCleanupRequired = false;

export function overrideIdForAction(action: ScenarioActionIdentity, slotHeight: number, actionIndex: number): string {
  return action.overrideId || `${action.actionId}_${slotHeight}_${actionIndex}`;
}

export function scenarioStepHeight(slotNumber: number | undefined, stepIndex: number): number {
  return slotNumber ?? stepIndex;
}

export function scenarioTimelineStepPosition(stepIndex: number, totalSteps: number): number {
  return totalSteps > 1 ? 12.5 + (stepIndex / (totalSteps - 1)) * 75 : 50;
}

export function dispatchAbsoluteSlotChange(absoluteSlot: number): void {
  window.dispatchEvent(
    new CustomEvent('epochChanged', {
      detail: { absoluteSlot },
    })
  );
}

export function jsonRpcContextSlot(payload: unknown): number | null {
  if (payload === null || typeof payload !== 'object') return null;
  const slot = (payload as { result?: { context?: { slot?: unknown } } }).result?.context?.slot;
  return typeof slot === 'number' && Number.isSafeInteger(slot) ? slot : null;
}

export function beginPlaybackCleanup(runCleanup: () => Promise<boolean>): Promise<boolean> {
  if (pendingPlaybackCleanup) return pendingPlaybackCleanup;

  playbackCleanupRequired = true;
  const cleanup = runCleanup();
  pendingPlaybackCleanup = cleanup;
  function finishCleanup(succeeded: boolean) {
    if (succeeded) playbackCleanupRequired = false;
    if (pendingPlaybackCleanup === cleanup) pendingPlaybackCleanup = null;
  }
  function retainRequiredCleanup() {
    if (pendingPlaybackCleanup === cleanup) pendingPlaybackCleanup = null;
  }
  void cleanup.then(finishCleanup, retainRequiredCleanup);
  return cleanup;
}

export async function waitForPlaybackCleanup(): Promise<boolean> {
  return pendingPlaybackCleanup ?? !playbackCleanupRequired;
}

export function nextScenarioSlotHeight(slots: ReadonlyArray<{ height: number }>): number {
  return slots.reduce((maximum, slot) => Math.max(maximum, slot.height), -1) + 1;
}

export function scenarioSlotInsertionHeight(
  slots: ReadonlyArray<{ height: number }>,
  insertionIndex: number
): number | null {
  const previousHeight = slots[insertionIndex - 1]?.height ?? -1;
  const nextHeight = slots[insertionIndex]?.height;
  const candidate = previousHeight + 1;
  return nextHeight !== undefined && candidate >= nextHeight ? null : candidate;
}

export function validateScenarioSlotHeights(slots: ReadonlyArray<{ height: number }>): string | null {
  if (slots.length === 0 || slots[0].height !== 0) return 'A scenario must start at slot 0';

  for (const [index, slot] of slots.entries()) {
    if (!Number.isSafeInteger(slot.height) || slot.height < 0) {
      return 'Scenario slot heights must be non-negative safe integers';
    }
    if (index > 0 && slot.height <= slots[index - 1].height) {
      return 'Scenario slot heights must be unique and strictly increasing';
    }
  }

  return null;
}

export function parseOverrideOutcomeResponse(payload: unknown, fallbackMessage: string): ParsedOverrideOutcomeResponse {
  if (payload === null || typeof payload !== 'object') {
    return { ok: false, message: fallbackMessage };
  }

  const response = payload as {
    error?: { message?: unknown };
    result?: {
      context?: { slot?: unknown };
      value?: unknown;
      absoluteSlot?: unknown;
      overrideOutcomes?: unknown;
    };
  };
  if (response.error) {
    return {
      ok: false,
      message: typeof response.error.message === 'string' ? response.error.message : fallbackMessage,
    };
  }

  const value = response.result?.value ?? response.result?.overrideOutcomes;
  const slot = response.result?.context?.slot ?? response.result?.absoluteSlot;
  if (!Array.isArray(value) || typeof slot !== 'number') {
    return { ok: false, message: fallbackMessage };
  }

  const outcomes = value as OverrideOutcome[];
  const hasInvalidOutcome = outcomes.some(
    (outcome) =>
      outcome === null ||
      typeof outcome !== 'object' ||
      typeof outcome.overrideId !== 'string' ||
      typeof outcome.applied !== 'boolean'
  );
  if (hasInvalidOutcome) {
    return { ok: false, message: fallbackMessage };
  }

  return { ok: true, outcomes, slot };
}

export function mergeOverrideOutcomes(
  current: OverrideOutcomeState,
  outcomes: OverrideOutcome[]
): OverrideOutcomeState {
  const next = { ...current };
  for (const outcome of outcomes) {
    next[outcome.overrideId] = {
      applied: outcome.applied,
      reason: outcome.reason ?? undefined,
    };
  }
  return next;
}

export function skippedOverrideToast(
  outcomes: OverrideOutcome[],
  slotHeight: number
): SkippedOverrideToast | null {
  const skipped = outcomes.filter((outcome) => !outcome.applied);
  if (skipped.length === 0) return null;

  const additionalCount = skipped.length - 1;
  const firstReason = skipped[0].reason ?? undefined;
  const description =
    additionalCount > 0
      ? `${firstReason ? `${firstReason}. ` : ''}+${additionalCount} more`
      : firstReason;

  return {
    title: `${skipped.length} override${skipped.length === 1 ? '' : 's'} skipped at slot ${slotHeight}`,
    description,
  };
}
