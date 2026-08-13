'use client';

import ScenariosBento from '@/components/svm/scenarios-bento';
import { useAppConfig } from '@/hooks/use-app-config';
import { parseScenariosJson } from '@/lib/scenarios-api';
import { Scenario } from '@/lib/scenarios-data';
import { logger } from '@surfpool/shared';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function ScenariosContent() {
  const searchParams = useSearchParams();
  const { studioUrl } = useAppConfig();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDetailPaneOpen, setIsDetailPaneOpen] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Read search params reactively - these will update when URL changes
  const selectedId = searchParams?.get('id') || undefined;
  const selectedTab = searchParams?.get('tab') || undefined;

  // Debug: log when search params change
  useEffect(() => {
    logger.log('Search params changed:', { selectedId, selectedTab });
  }, [selectedId, selectedTab]);

  useEffect(() => {
    async function loadScenarios() {
      try {
        // Full-screen spinner only on the first load. Later refetches (create,
        // close-with-pending-update) swap the list in the background, so the page
        // does not blank out and feel like a hard reload.
        if (!hasLoadedRef.current) setLoading(true);

        const response = await fetch(`${studioUrl}/v1/scenarios`);

        if (!response.ok) {
          throw new Error(`Failed to fetch scenarios: ${response.status}`);
        }

        const data = parseScenariosJson(await response.text());
        logger.log('Loaded scenarios from API:', data);

        // Convert API response to scenarios array
        // Handle both array response and object response
        let loadedScenarios: Scenario[];

        if (Array.isArray(data)) {
          // API returned an array of scenarios
          loadedScenarios = data.map((scenarioData: any) => {
            const scenario: Scenario = {
              id: scenarioData.id, // Use the ID from the scenario object itself
              name: scenarioData.name || `Scenario ${scenarioData.id}`,
              description: scenarioData.description,
              status: scenarioData.status || 'active',
              created_at: scenarioData.created_at,
              updated_at: scenarioData.updated_at,
              tags: scenarioData.tags,
            };

            // Convert overrides to steps/slots for UI
            if (scenarioData.overrides && scenarioData.overrides.length > 0) {
              // Group overrides by scenarioRelativeSlot
              const slotMap = new Map<number, any[]>();

              scenarioData.overrides.forEach((override: any) => {
                const slotNumber = override.scenarioRelativeSlot !== undefined ? override.scenarioRelativeSlot : 0;
                if (!slotMap.has(slotNumber)) {
                  slotMap.set(slotNumber, []);
                }

                // Extract protocol from templateId (everything before first dash is usually the protocol)
                const templateId = override.templateId || '';
                const firstDashIndex = templateId.indexOf('-');
                const protocolId = firstDashIndex > 0 ? templateId.substring(0, firstDashIndex) : templateId;

                slotMap.get(slotNumber)!.push({
                  original: override,
                  overrideId: override.id, // Preserve the override ID from backend
                  protocolId: protocolId || 'unknown',
                  actionId: templateId || 'unknown', // Use full templateId as actionId
                  protocol: protocolId.charAt(0).toUpperCase() + protocolId.slice(1), // Capitalize protocol name
                  action: override.label || 'Unknown Action',
                  account: override.account, // Preserve account data
                  fetchBeforeUse: override.fetchBeforeUse || false,
                  overrides: override.values || {}, // Preserve the values from backend
                  modifiedFields: Object.keys(override.values || {}), // Track which fields were modified
                });
              });

              // Convert map to array of steps
              scenario.steps = Array.from(slotMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([slotNumber, actions]) => ({
                  id: `slot-${slotNumber}`,
                  name: `Slot ${slotNumber}`,
                  type: 'slot',
                  status: 'pending',
                  slotNumber,
                  actions: actions,
                }));
            }

            return scenario;
          });
        } else {
          // API returned an object with scenario IDs as keys
          loadedScenarios = Object.entries(data as Record<string, any>).map(([id, scenarioData]: [string, any]) => {
            const scenario: Scenario = {
              id: scenarioData.id || id, // Prefer scenario.id, fallback to key
              name: scenarioData.name || `Scenario ${id}`,
              description: scenarioData.description,
              status: scenarioData.status || 'active',
              created_at: scenarioData.created_at,
              updated_at: scenarioData.updated_at,
              tags: scenarioData.tags,
            };

            // Convert overrides to steps/slots for UI
            if (scenarioData.overrides && scenarioData.overrides.length > 0) {
              // Group overrides by scenarioRelativeSlot
              const slotMap = new Map<number, any[]>();

              scenarioData.overrides.forEach((override: any) => {
                const slotNumber = override.scenarioRelativeSlot !== undefined ? override.scenarioRelativeSlot : 0;
                if (!slotMap.has(slotNumber)) {
                  slotMap.set(slotNumber, []);
                }

                // Extract protocol from templateId (everything before first dash is usually the protocol)
                const templateId = override.templateId || '';
                const firstDashIndex = templateId.indexOf('-');
                const protocolId = firstDashIndex > 0 ? templateId.substring(0, firstDashIndex) : templateId;

                slotMap.get(slotNumber)!.push({
                  original: override,
                  overrideId: override.id, // Preserve the override ID from backend
                  protocolId: protocolId || 'unknown',
                  actionId: templateId || 'unknown', // Use full templateId as actionId
                  protocol: protocolId.charAt(0).toUpperCase() + protocolId.slice(1), // Capitalize protocol name
                  action: override.label || 'Unknown Action',
                  account: override.account, // Preserve account data
                  fetchBeforeUse: override.fetchBeforeUse || false,
                  overrides: override.values || {}, // Preserve the values from backend
                  modifiedFields: Object.keys(override.values || {}), // Track which fields were modified
                });
              });

              // Convert map to array of steps
              scenario.steps = Array.from(slotMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([slotNumber, actions]) => ({
                  id: `slot-${slotNumber}`,
                  name: `Slot ${slotNumber}`,
                  type: 'slot',
                  status: 'pending',
                  slotNumber,
                  actions: actions,
                }));
            }

            return scenario;
          });
        }

        setScenarios(loadedScenarios);
        setRefreshError(null);
      } catch (error) {
        console.error('Error loading scenarios:', error);
        // Only blank the list if we never had one. A failed background refetch
        // keeps the current list rather than wiping it, but says the refresh failed.
        if (!hasLoadedRef.current) {
          setScenarios([]);
        } else {
          setRefreshError("Couldn't refresh the scenarios list.");
        }
      } finally {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    }

    loadScenarios();
  }, [refreshKey, studioUrl]);

  // The editor dispatches this while its pane is open; defer the refresh to close.
  useEffect(() => {
    const handleScenarioUpdate = () => {
      if (isDetailPaneOpen) {
        logger.log('Scenario updated while detail pane open - deferring refresh until close');
        setPendingRefresh(true);
      } else {
        logger.log('Scenario updated event received, refreshing scenarios');
        setRefreshKey((prev) => prev + 1);
      }
    };

    window.addEventListener('scenarioUpdated', handleScenarioUpdate);
    return () => window.removeEventListener('scenarioUpdated', handleScenarioUpdate);
  }, [isDetailPaneOpen]);

  // Flush the deferred refresh once the detail pane closes.
  useEffect(() => {
    if (!isDetailPaneOpen && pendingRefresh) {
      logger.log('Detail pane closed with a pending update - refreshing scenarios');
      setRefreshKey((prev) => prev + 1);
      setPendingRefresh(false);
    }
  }, [isDetailPaneOpen, pendingRefresh]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleDismissRefreshError = () => {
    setRefreshError(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading scenarios...</div>
      </div>
    );
  }

  return (
    <>
      <ScenariosBento
        scenarios={scenarios}
        onRefresh={handleRefresh}
        onDetailPaneChange={setIsDetailPaneOpen}
        initialSelectedId={selectedId}
        initialTab={selectedTab}
      />
      {!!refreshError && (
        <div
          role="status"
          className="fixed bottom-6 left-6 z-50 flex items-center gap-3 rounded-lg bg-zinc-900/90 px-3 py-2 text-sm text-red-400 shadow-lg"
        >
          <span>{refreshError}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-zinc-300 underline-offset-2 hover:underline"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={handleDismissRefreshError}
            aria-label="Dismiss"
            className="text-zinc-500 hover:text-zinc-300"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

export default function Scenarios() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading scenarios...</div>
        </div>
      }
    >
      <ScenariosContent />
    </Suspense>
  );
}
