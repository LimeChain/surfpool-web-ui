import { renderWithConfig } from '@/test-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ScenariosBento from './scenarios-bento';
import type { ScenarioBentoItem } from './scenarios-bento.types';

const editorMounts = vi.hoisted(function createEditorMountSpy() {
  return vi.fn();
});

const toastError = vi.hoisted(function createToastErrorSpy() {
  return vi.fn();
});

vi.mock('sonner', function mockSonner() {
  return { toast: { error: toastError } };
});

vi.mock('next/dynamic', async function mockNextDynamic() {
  const React = await import('react');

  function MockScenarioEditor({ scenarioId }: { scenarioId: string }) {
    function captureMountedScenarioId() {
      editorMounts(scenarioId);
      return scenarioId;
    }

    const [mountedScenarioId] = React.useState(captureMountedScenarioId);

    return <div data-testid="scenario-editor">{mountedScenarioId}</div>;
  }

  function dynamicMock() {
    return MockScenarioEditor;
  }

  return { default: dynamicMock };
});

vi.mock('next/navigation', function mockNextNavigation() {
  return {
    useRouter: vi.fn().mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    }),
  };
});

vi.mock('@surfpool/ui', function mockSurfpoolUi() {
  function HiddenDialog() {
    return null;
  }

  function Passthrough({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  return {
    Button: Passthrough,
    Dialog: HiddenDialog,
    DialogActions: Passthrough,
    DialogDescription: Passthrough,
    DialogTitle: Passthrough,
    Dropdown: Passthrough,
    DropdownButton: Passthrough,
    DropdownItem: Passthrough,
    DropdownMenu: Passthrough,
  };
});

vi.mock('./ai-header', function mockAiHeaderModule() {
  return {
    default: function MockAiHeader() {
      return null;
    },
  };
});

vi.mock('./generic-bento', function mockGenericBentoModule() {
  interface GenericBentoMockProps {
    items: ScenarioBentoItem[];
    initialSelectedId?: string;
    initialTab?: string;
    renderDetailHeader: (item: ScenarioBentoItem) => ReactNode;
    renderDetailContent: (item: ScenarioBentoItem, activeTab: string) => ReactNode;
  }

  function GenericBentoMock({
    items,
    initialSelectedId,
    initialTab,
    renderDetailHeader,
    renderDetailContent,
  }: GenericBentoMockProps) {
    function isSelectedItem(item: ScenarioBentoItem) {
      return item.id === initialSelectedId;
    }

    const selectedItem = items.find(isSelectedItem);
    return selectedItem ? (
      <>
        {renderDetailHeader(selectedItem)}
        {renderDetailContent(selectedItem, initialTab ?? 'editor')}
      </>
    ) : null;
  }

  return { default: GenericBentoMock };
});

const scenarios = [
  {
    id: 'scenario-a',
    name: 'Scenario A',
    description: 'First scenario',
    steps: [{ id: 'slot-a', name: 'Slot A', type: 'slot', slotNumber: 0 }],
  },
  {
    id: 'scenario-b',
    name: 'Scenario B',
    description: 'Second scenario',
    steps: [{ id: 'slot-b', name: 'Slot B', type: 'slot', slotNumber: 450 }],
  },
];

function createPendingResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(function captureResolve(promiseResolve) {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

afterEach(function restoreGlobals() {
  vi.unstubAllGlobals();
  toastError.mockClear();
});

describe('ScenariosBento', function scenariosBentoTests() {
  it('remounts the scenario editor when the selected scenario changes', function remountsEditorOnScenarioChange() {
    const { rerender } = renderWithConfig(
      <ScenariosBento scenarios={scenarios} initialSelectedId="scenario-a" initialTab="editor" />
    );

    expect(screen.getByTestId('scenario-editor')).toHaveTextContent('scenario-a');

    rerender(<ScenariosBento scenarios={scenarios} initialSelectedId="scenario-b" initialTab="editor" />);

    expect(screen.getByTestId('scenario-editor')).toHaveTextContent('scenario-b');
    expect(editorMounts).toHaveBeenCalledTimes(2);
    expect(editorMounts).toHaveBeenNthCalledWith(1, 'scenario-a');
    expect(editorMounts).toHaveBeenNthCalledWith(2, 'scenario-b');
  });

  it('serializes overlapping edits and keeps failed changes out of the UI', async function serializesFailedEdits() {
    const firstResponse = createPendingResponse();
    const secondResponse = createPendingResponse();
    const fetchMock = vi.fn().mockReturnValueOnce(firstResponse.promise).mockReturnValueOnce(secondResponse.promise);
    vi.stubGlobal('fetch', fetchMock);

    renderWithConfig(<ScenariosBento scenarios={scenarios} initialSelectedId="scenario-a" initialTab="overview" />);

    fireEvent.click(screen.getByText('Scenario A'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Failed name' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    fireEvent.click(screen.getByText('First scenario'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Failed description' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(screen.getByText('Failed name')).toBeInTheDocument();
    expect(screen.getByText('Failed description')).toBeInTheDocument();

    await waitFor(function waitsForFirstUpdate() {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await act(async function failFirstUpdate() {
      firstResponse.resolve({ ok: false, status: 500 } as Response);
      await firstResponse.promise;
    });

    await waitFor(function waitsForSecondUpdate() {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const secondRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const secondPayload = JSON.parse(secondRequest.body as string);
    expect(secondPayload.name).toBe('Scenario A');
    expect(secondPayload.description).toBe('Failed description');

    await act(async function failSecondUpdate() {
      secondResponse.resolve({ ok: false, status: 500 } as Response);
      await secondResponse.promise;
    });

    expect(screen.getByText('Scenario A')).toBeInTheDocument();
    expect(screen.getByText('First scenario')).toBeInTheDocument();
    expect(screen.queryByText('Failed name')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed description')).not.toBeInTheDocument();
    expect(toastError).toHaveBeenCalledTimes(2);
    expect(toastError).toHaveBeenLastCalledWith(
      "Couldn't save the scenario changes.",
      expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) })
    );
  });
});
