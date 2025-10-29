'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/solid';
import GenericBento, { BentoItem } from './generic-bento';
import { Dialog, DialogActions, DialogDescription, DialogTitle } from '@/components/catalyst/dialog';
import { Button } from '@/components/catalyst/button';

const ScenarioEditor = dynamic(() => import('./scenario-editor').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading editor...</div>
    </div>
  ),
});

interface Scenario {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  steps?: Array<{
    id: string;
    name: string;
    type: string;
    status?: string;
  }>;
  metadata?: Record<string, any>;
}

interface ScenariosBentoProps {
  scenarios: Scenario[];
}

// Extend Scenario to match BentoItem interface
interface ScenarioBentoItem extends BentoItem {
  created_at?: string;
  updated_at?: string;
  steps?: Array<{
    id: string;
    name: string;
    type: string;
    status?: string;
    actions?: Array<{
      protocolId: string;
      actionId: string;
      protocol: string;
      action: string;
    }>;
  }>;
}

export default function ScenariosBento({ scenarios: initialScenarios }: ScenariosBentoProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState<string | null>(null);
  const [isDetailPaneOpen, setIsDetailPaneOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<{ id: string; onClose?: () => void } | null>(null);

  // Create new scenario
  const handleCreateScenario = () => {
    const newScenario: Scenario = {
      id: String(Date.now()),
      name: 'New Scenario',
      description: 'Add a description...',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      steps: [],
    };
    setScenarios([...scenarios, newScenario]);
    // Enable title editing for the new scenario
    setTimeout(() => setEditingTitle(newScenario.id), 100);
    return newScenario.id;
  };

  // Update scenario
  const handleUpdateScenario = (id: string, updates: Partial<Scenario>) => {
    setScenarios(scenarios.map(s =>
      s.id === id
        ? { ...s, ...updates, updated_at: new Date().toISOString() }
        : s
    ));
  };

  // Delete scenario
  const handleDeleteScenario = (id: string) => {
    setScenarios(scenarios.filter(s => s.id !== id));
  };

  // Transform scenarios to match BentoItem interface
  const bentoItems: ScenarioBentoItem[] = scenarios.map((scenario) => ({
    id: String(scenario.id),
    name: String(scenario.name),
    description: String(scenario.description || 'No description available'),
    status: scenario.status
      ? {
          online: scenario.status === 'active' || scenario.status === 'running',
          status: String(scenario.status),
        }
      : undefined,
    created_at: scenario.created_at,
    updated_at: scenario.updated_at,
    steps: scenario.steps,
    metadata: scenario.metadata,
  }));

  const renderItem = (item: ScenarioBentoItem, isSelected: boolean) => {
    const localIconMap: Record<string, string> = {
      pyth: '/assets/pyth.svg',
      switchboard: '/assets/switchboard.svg',
      jupiter: '/assets/jupiter.svg',
      raydium: '/assets/raydium.svg',
      whirlpool: '/assets/whirlpool.svg',
      drift: '/assets/drift.svg',
      kamino: '/assets/kamino.svg',
    };

    // Get actual slots from scenario data
    const slots = item.steps || [];

    return (
      <>
        <div
          className={`absolute inset-0 rounded-2xl transition-colors duration-200 ${
            isSelected
              ? 'bg-zinc-300 dark:bg-zinc-800'
              : 'bg-zinc-50 group-hover:bg-zinc-100 dark:bg-zinc-900 dark:group-hover:bg-zinc-800'
          }`}
        />
        <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.2xl)+1px)] border border-zinc-200/40 transition-colors duration-200 group-hover:border-zinc-300/60 dark:border-zinc-700/30 dark:group-hover:border-zinc-600/50">
          {/* Header Section */}
          <div className="flex items-start justify-between p-6 pb-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-md truncate font-semibold text-zinc-950 dark:text-zinc-50">{item.name}</h3>
              {item.description && item.description !== 'null' && item.description !== 'No description available' && (
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
              )}
            </div>
          </div>

          {/* Footer Section with Timeline */}
          <div
            className="relative mt-auto border-t border-zinc-200/40 bg-zinc-100/50 py-4 dark:border-zinc-700/30 dark:bg-zinc-950/50"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(161, 161, 170, 0.15) 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          >
            {/* Timeline ruler line - at the very top, full width */}
            <div className="pointer-events-none absolute top-0 right-0 left-0 h-px bg-zinc-300 dark:bg-zinc-700" />

            {/* Timeline ticks - aligned with slot centers */}
            <div className="pointer-events-none absolute top-0 right-6 left-6 flex items-start gap-2">
              {slots.map((slot, slotIndex) => (
                <div
                  key={`tick-${slot.id}`}
                  className="flex flex-shrink-0 items-center justify-center"
                  style={{ width: '47px' }}
                >
                  <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                </div>
              ))}
            </div>

            {/* Timeline slots */}
            <div className="relative px-6 pt-1">
              <div className="flex items-start gap-2 overflow-x-auto">
                {slots.map((slot, slotIndex) => {
                  const actions = slot.actions || [];
                  const maxVisible = 3;
                  const visibleActions = actions.slice(0, maxVisible);
                  const remaining = actions.length - maxVisible;

                  return (
                    <div
                      key={slot.id}
                      className="flex flex-shrink-0 flex-col items-center gap-1.5 rounded-lg border border-zinc-300 bg-zinc-50 p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <div className="flex flex-col gap-1">
                        {actions.length === 0 ? (
                          <div className="flex h-7 w-7 items-center justify-center rounded">
                            <div className="h-4 w-4 rounded border border-dashed border-zinc-400 dark:border-zinc-600" />
                          </div>
                        ) : (
                          visibleActions.map((action, iconIndex) => {
                            const isLast = iconIndex === visibleActions.length - 1 && remaining > 0;
                            return (
                              <div
                                key={`${slot.id}-${action.actionId}-${iconIndex}`}
                                className="relative flex h-7 w-7 items-center justify-center rounded"
                                title={`${action.protocol}: ${action.action}`}
                              >
                                {isLast ? (
                                  <div className="flex h-full w-full items-center justify-center rounded bg-zinc-200 dark:bg-zinc-700">
                                    <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                                      +{remaining}
                                    </span>
                                  </div>
                                ) : (
                                  <img
                                    src={localIconMap[action.protocolId] || '/assets/default.svg'}
                                    alt={action.protocol}
                                    className="h-5 w-5"
                                  />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-lg ring-1 shadow-zinc-950/[0.03] ring-zinc-950/5 transition-shadow duration-200 group-hover:shadow-xl group-hover:shadow-zinc-950/[0.05] dark:shadow-zinc-950/50 dark:ring-zinc-50/10 dark:group-hover:shadow-zinc-950/70" />
      </>
    );
  };

  const renderDetailHeader = (item: ScenarioBentoItem, onClose?: () => void) => (
    <div className="flex-1">
      {editingTitle === item.id ? (
        <input
          type="text"
          value={item.name}
          onChange={(e) => handleUpdateScenario(item.id, { name: e.target.value })}
          onBlur={() => setEditingTitle(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditingTitle(null);
          }}
          autoFocus
          className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-1 text-base font-semibold text-zinc-950 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:text-zinc-50"
        />
      ) : (
        <h2
          className="group flex items-center gap-2 truncate text-base font-semibold text-zinc-950 dark:text-zinc-50 cursor-pointer"
          onClick={() => setEditingTitle(item.id)}
        >
          {item.name}
          <PencilIcon className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
        </h2>
      )}
    </div>
  );

  const renderDetailActions = (item: ScenarioBentoItem, onClose?: () => void) => (
    <button
      onClick={() => {
        setScenarioToDelete({ id: item.id, onClose });
        setDeleteDialogOpen(true);
      }}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500 transition-all hover:bg-red-500/20"
      title="Delete scenario"
    >
      <TrashIcon className="h-5 w-5" />
    </button>
  );

  const renderDetailContent = (item: ScenarioBentoItem, activeTab: string) => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 p-8 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                    Description
                  </h3>
                  {editingDescription === item.id ? (
                    <textarea
                      value={item.description === 'No description available' ? '' : item.description}
                      onChange={(e) => handleUpdateScenario(item.id, { description: e.target.value })}
                      onBlur={() => setEditingDescription(null)}
                      autoFocus
                      rows={3}
                      className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:text-zinc-50"
                    />
                  ) : (
                    <p
                      className="group cursor-pointer text-sm text-zinc-950 dark:text-zinc-50 hover:text-zinc-700 dark:hover:text-zinc-300"
                      onClick={() => setEditingDescription(item.id)}
                    >
                      {item.description && item.description !== 'null' && item.description !== 'No description available'
                        ? item.description
                        : 'Click to add description...'}
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                    Total Steps
                  </h3>
                  <p className="text-sm text-zinc-950 dark:text-zinc-50">{item.steps?.length || 0}</p>
                </div>
                {item.created_at && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                      Created At
                    </h3>
                    <p className="text-sm text-zinc-950 dark:text-zinc-50">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {item.updated_at && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                      Last Updated
                    </h3>
                    <p className="text-sm text-zinc-950 dark:text-zinc-50">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'editor':
        return (
          <div className="h-[calc(100vh-300px)]">
            <ScenarioEditor
              scenarioId={item.id}
              scenarioName={item.name}
              scenarioDescription={item.description}
              initialSteps={item.steps}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: null },
    { id: 'editor', label: 'Scenario', icon: null },
  ];

  return (
    <div className="relative h-full">
      <GenericBento
        items={bentoItems}
        searchPlaceholder="Search scenarios..."
        emptyMessage="No scenarios found"
        renderItem={renderItem}
        renderDetailHeader={renderDetailHeader}
        renderDetailContent={renderDetailContent}
        renderDetailActions={renderDetailActions}
        tabs={tabs}
        defaultTab="overview"
        onSelectionChange={(item) => setIsDetailPaneOpen(item !== null)}
      />

      {/* Add New Scenario Button - Fixed at bottom right, hidden when detail pane is open */}
      {!isDetailPaneOpen && (
        <div className="fixed right-6 bottom-6 z-50">
          <button
            onClick={handleCreateScenario}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition-all duration-200 hover:scale-110 hover:bg-pink-400 hover:shadow-xl"
            title="Create new scenario"
          >
            <PlusIcon className="h-7 w-7" />
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={setDeleteDialogOpen} size="xl">
        <DialogTitle>Delete Scenario?</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this scenario? This action cannot be undone.
        </DialogDescription>
        <DialogActions>
          <Button color="dark" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              if (scenarioToDelete) {
                handleDeleteScenario(scenarioToDelete.id);
                scenarioToDelete.onClose?.();
              }
              setDeleteDialogOpen(false);
              setScenarioToDelete(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
