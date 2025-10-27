'use client';

import { useEffect, useState } from 'react';
import ScenariosBento from '@/components/svm/scenarios-bento';
import { Scenario } from '@/pages/api/scenarios';

export default function Scenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchScenarios() {
      try {
        const response = await fetch('/api/scenarios');
        if (!response.ok) {
          throw new Error('Failed to fetch scenarios');
        }
        const data = await response.json();

        // Merge with localStorage data
        if (typeof window !== 'undefined') {
          const savedScenarios = localStorage.getItem('scenarios');
          if (savedScenarios) {
            try {
              const savedData = JSON.parse(savedScenarios);

              // Update scenarios with saved slots
              const mergedScenarios = data.scenarios.map((scenario: Scenario) => {
                const saved = savedData[scenario.id];
                if (saved?.slots) {
                  // Convert slots to steps format
                  const steps = saved.slots.map((slot: any, index: number) => ({
                    id: slot.id,
                    name: `Slot ${index}`,
                    type: 'slot',
                    status: 'pending',
                    actions: slot.actions,
                  }));
                  return { ...scenario, steps };
                }
                return scenario;
              });

              setScenarios(mergedScenarios);
            } catch (error) {
              console.error('Error parsing saved scenarios:', error);
              setScenarios(data.scenarios);
            }
          } else {
            setScenarios(data.scenarios);
          }
        } else {
          setScenarios(data.scenarios);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchScenarios();
  }, [refreshKey]);

  // Listen for scenario updates
  useEffect(() => {
    const handleScenarioUpdate = () => {
      setRefreshKey((prev) => prev + 1);
    };

    window.addEventListener('scenarioUpdated', handleScenarioUpdate);
    return () => window.removeEventListener('scenarioUpdated', handleScenarioUpdate);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading scenarios...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return <ScenariosBento scenarios={scenarios} />;
}
