'use client';

import { Badge } from '@/components/catalyst/badge';
import GenericBento, { BentoItem } from './generic-bento';

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
  }>;
}

export default function ScenariosBento({ scenarios }: ScenariosBentoProps) {
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

  const renderItem = (item: ScenarioBentoItem, isSelected: boolean) => (
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

        {/* Footer Section */}
        <div className="mt-auto border-t border-zinc-200/40 bg-zinc-100/50 px-6 py-4 dark:border-zinc-700/30 dark:bg-zinc-950/50">
          <div className="flex items-center justify-between">
            {item.steps && (
              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                {item.steps.length} {item.steps.length === 1 ? 'step' : 'steps'}
              </span>
            )}
            {item.status?.status && (
              <>
                {item.status.status === 'active' || item.status.status === 'running' ? (
                  <Badge color="emerald">Active</Badge>
                ) : item.status.status === 'completed' ? (
                  <Badge color="lime">Completed</Badge>
                ) : item.status.status === 'failed' ? (
                  <Badge color="red">Failed</Badge>
                ) : (
                  <Badge color="zinc">Inactive</Badge>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-lg ring-1 shadow-zinc-950/[0.03] ring-zinc-950/5 transition-shadow duration-200 group-hover:shadow-xl group-hover:shadow-zinc-950/[0.05] dark:shadow-zinc-950/50 dark:ring-zinc-50/10 dark:group-hover:shadow-zinc-950/70" />
    </>
  );

  const renderDetailHeader = (item: ScenarioBentoItem) => (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <h2 className="truncate text-xl font-semibold text-zinc-950 dark:text-zinc-50">{item.name}</h2>
      {item.status?.status && (
        <>
          {item.status.status === 'active' || item.status.status === 'running' ? (
            <Badge color="emerald">Active</Badge>
          ) : item.status.status === 'completed' ? (
            <Badge color="lime">Completed</Badge>
          ) : item.status.status === 'failed' ? (
            <Badge color="red">Failed</Badge>
          ) : (
            <Badge color="zinc">Inactive</Badge>
          )}
        </>
      )}
    </div>
  );

  const renderDetailContent = (item: ScenarioBentoItem, activeTab: string) => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                {item.description && item.description !== 'null' && item.description !== 'No description available' && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                      Description
                    </h3>
                    <p className="text-sm text-zinc-950 dark:text-zinc-50">{item.description}</p>
                  </div>
                )}
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
                {item.status?.status && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                      Status
                    </h3>
                    <p className="text-sm text-zinc-950 capitalize dark:text-zinc-50">{item.status.status}</p>
                  </div>
                )}
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
                {item.metadata && Object.keys(item.metadata).length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                      Metadata
                    </h3>
                    <div className="space-y-1">
                      {Object.entries(item.metadata).map(([key, value]) => (
                        <div key={key} className="text-sm text-zinc-950 dark:text-zinc-50">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'steps':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  All Steps ({item.steps?.length || 0})
                </h3>
              </div>
              {item.steps && item.steps.length > 0 ? (
                item.steps.map((step, index) => (
                  <div
                    key={String(step.id)}
                    className="flex items-start justify-between rounded-lg border border-zinc-200/40 bg-zinc-50 p-4 transition-colors hover:border-zinc-300 dark:border-zinc-700/30 dark:bg-zinc-800 dark:hover:border-zinc-600"
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                          Step {index + 1}: {step.name}
                        </span>
                        {step.status && (
                          <>
                            {step.status === 'completed' ? (
                              <Badge color="lime">Completed</Badge>
                            ) : step.status === 'running' || step.status === 'active' ? (
                              <Badge color="emerald">Running</Badge>
                            ) : step.status === 'failed' ? (
                              <Badge color="red">Failed</Badge>
                            ) : (
                              <Badge color="zinc">Pending</Badge>
                            )}
                          </>
                        )}
                      </div>
                      <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">Type: {step.type}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-zinc-200/40 bg-zinc-50 dark:border-zinc-700/30 dark:bg-zinc-800">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No steps defined</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-zinc-200/40 bg-zinc-50 p-6 dark:border-zinc-700/30 dark:bg-zinc-800">
              <h3 className="mb-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">Scenario Details</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 border-b border-zinc-200/40 pb-2 dark:border-zinc-700/30">
                  <span className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">ID</span>
                  <span className="col-span-2 font-mono text-sm text-zinc-950 dark:text-zinc-50">{item.id}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 border-b border-zinc-200/40 pb-2 dark:border-zinc-700/30">
                  <span className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">Name</span>
                  <span className="col-span-2 text-sm text-zinc-950 dark:text-zinc-50">{item.name}</span>
                </div>
                {item.description && item.description !== 'null' && item.description !== 'No description available' && (
                  <div className="grid grid-cols-3 gap-4 border-b border-zinc-200/40 pb-2 dark:border-zinc-700/30">
                    <span className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">
                      Description
                    </span>
                    <span className="col-span-2 text-sm text-zinc-950 dark:text-zinc-50">{item.description}</span>
                  </div>
                )}
                {item.status?.status && (
                  <div className="grid grid-cols-3 gap-4 border-b border-zinc-200/40 pb-2 dark:border-zinc-700/30">
                    <span className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">Status</span>
                    <span className="col-span-2 text-sm text-zinc-950 capitalize dark:text-zinc-50">
                      {item.status.status}
                    </span>
                  </div>
                )}
                {item.created_at && (
                  <div className="grid grid-cols-3 gap-4 border-b border-zinc-200/40 pb-2 dark:border-zinc-700/30">
                    <span className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">Created At</span>
                    <span className="col-span-2 text-sm text-zinc-950 dark:text-zinc-50">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                )}
                {item.updated_at && (
                  <div className="grid grid-cols-3 gap-4 pb-2">
                    <span className="text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">
                      Last Updated
                    </span>
                    <span className="col-span-2 text-sm text-zinc-950 dark:text-zinc-50">
                      {new Date(item.updated_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Play', icon: null },
    { id: 'steps', label: 'Edit Timeline', icon: null },
    { id: 'details', label: 'Settings', icon: null },
  ];

  return (
    <GenericBento
      items={bentoItems}
      searchPlaceholder="Search scenarios..."
      emptyMessage="No scenarios found"
      renderItem={renderItem}
      renderDetailHeader={renderDetailHeader}
      renderDetailContent={renderDetailContent}
      tabs={tabs}
      defaultTab="overview"
    />
  );
}
