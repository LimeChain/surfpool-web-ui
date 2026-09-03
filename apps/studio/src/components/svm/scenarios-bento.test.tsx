import { renderWithConfig } from '@/test-utils';
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ScenarioBentoItem } from './scenarios-bento.types';
import ScenariosBento from './scenarios-bento';

const editorMounts = vi.hoisted(function createEditorMountSpy() {
  return vi.fn();
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
    renderDetailContent: (item: ScenarioBentoItem, activeTab: string) => ReactNode;
  }

  function GenericBentoMock({ items, initialSelectedId, initialTab, renderDetailContent }: GenericBentoMockProps) {
    function isSelectedItem(item: ScenarioBentoItem) {
      return item.id === initialSelectedId;
    }

    const selectedItem = items.find(isSelectedItem);
    return selectedItem ? renderDetailContent(selectedItem, initialTab ?? 'editor') : null;
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
});
