import { renderWithConfig } from '@/test-utils';
import { beginPlaybackCleanup } from '@/lib/scenarios-playback';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScenarioEditor from './scenario-editor';

vi.mock('./transaction-inspector', function mockTransactionInspector() {
  return { default: function MockTransactionInspector() { return null; } };
});

const initialSteps = [
  {
    id: 'slot-0',
    name: 'Slot 0',
    type: 'slot',
    slotNumber: 0,
    actions: [
      {
        overrideId: 'override-0',
        protocolId: 'pyth',
        actionId: 'pyth-price',
        protocol: 'Pyth',
        action: 'Set price',
        overrides: { price: 85 },
        modifiedFields: ['price'],
      },
    ],
  },
];

type DeferredResponse = {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
};

function deferredResponse(): DeferredResponse {
  let resolve: ((value: unknown) => void) | undefined;
  const promise = new Promise<unknown>(function captureResolve(complete) {
    resolve = complete;
  });
  return { promise, resolve: resolve! };
}

function successfulResponse(value: unknown = {}): Response {
  return { ok: true, json: vi.fn().mockResolvedValue(value) } as unknown as Response;
}

function rpcMethod(input: RequestInfo | URL, init?: RequestInit): string | null {
  if (String(input) !== 'http://127.0.0.1:8899' || typeof init?.body !== 'string') return null;
  return JSON.parse(init.body).method ?? null;
}

async function clickPlay(): Promise<void> {
  fireEvent.click(await screen.findByTitle('Play scenario'));
}

afterEach(function restoreFetch() {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('ScenarioEditor playback cleanup', function scenarioEditorPlaybackCleanupTests() {
  it('does not reset Surfnet when an unmounted start never reaches pause', async () => {
    const previousCleanup = deferredResponse();
    const methods: string[] = [];
    beginPlaybackCleanup(function holdPreviousCleanup() {
      return previousCleanup.promise as Promise<boolean>;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async function fetchMock(input, init) {
      const method = rpcMethod(input, init);
      if (method) methods.push(method);
      if (String(input).endsWith('/v1/scenarios/templates')) return successfulResponse([]);
      return successfulResponse([]);
    });

    const editor = renderWithConfig(<ScenarioEditor scenarioId="scenario-a" initialSteps={initialSteps} />);
    await clickPlay();
    editor.unmount();

    expect(methods).toEqual([]);
    await act(async function finishPreviousCleanup() {
      previousCleanup.resolve(true);
      await previousCleanup.promise;
    });

    await waitFor(function expectNoPlaybackMutation() {
      expect(methods).toEqual([]);
    });
    expect(methods).not.toContain('surfnet_resumeClock');
    expect(methods).not.toContain('surfnet_resetNetwork');
    expect(methods).not.toContain('surfnet_registerScenario');
  });

  it('only resumes the clock when unmounted after pause starts', async () => {
    const pause = deferredResponse();
    const methods: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async function fetchMock(input, init) {
      const method = rpcMethod(input, init);
      if (method) methods.push(method);
      if (method === 'surfnet_pauseClock') return (await pause.promise) as Response;
      if (String(input).endsWith('/v1/scenarios/templates')) return successfulResponse([]);
      return successfulResponse([]);
    });

    const editor = renderWithConfig(<ScenarioEditor scenarioId="scenario-a" initialSteps={initialSteps} />);
    await clickPlay();
    editor.unmount();
    await act(async function finishPause() {
      pause.resolve(successfulResponse({ result: { value: null } }));
      await pause.promise;
    });

    await waitFor(function expectResumeWithoutReset() {
      expect(methods).toContain('surfnet_resumeClock');
    });
    expect(methods).not.toContain('surfnet_resetNetwork');
    expect(methods).not.toContain('surfnet_registerScenario');
  });

  it('resets Surfnet when unmounted after registration starts', async () => {
    const register = deferredResponse();
    const methods: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async function fetchMock(input, init) {
      const method = rpcMethod(input, init);
      if (method) methods.push(method);
      if (method === 'surfnet_pauseClock') return successfulResponse({ result: { value: null } });
      if (method === 'surfnet_registerScenario') return (await register.promise) as Response;
      if (String(input).endsWith('/v1/scenarios/templates')) return successfulResponse([]);
      return successfulResponse([]);
    });

    const editor = renderWithConfig(<ScenarioEditor scenarioId="scenario-a" initialSteps={initialSteps} />);
    await clickPlay();
    await waitFor(function expectRegistration() {
      expect(methods).toContain('surfnet_registerScenario');
    });
    editor.unmount();
    await act(async function finishRegistration() {
      register.resolve(successfulResponse({ result: { context: { slot: 1 }, value: [] } }));
      await register.promise;
    });

    await waitFor(function expectResetAndResume() {
      expect(methods).toContain('surfnet_resetNetwork');
      expect(methods).toContain('surfnet_resumeClock');
    });
  });
});
