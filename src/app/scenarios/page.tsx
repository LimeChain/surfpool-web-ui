'use client';

import { useEffect, useState } from 'react';
import ScenariosBento from '@/components/svm/scenarios-bento';
import { Scenario } from '@/lib/scenarios-data';

export default function Scenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function loadScenarios() {
      try {
        // Load from localStorage only
        if (typeof window !== 'undefined') {
          const savedScenarios = localStorage.getItem('scenarios');
          if (savedScenarios) {
            try {
              const savedData = JSON.parse(savedScenarios);

              // Convert saved data to scenarios array
              const loadedScenarios = Object.entries(savedData).map(([id, data]: [string, any]) => {
                const scenario: Scenario = {
                  id,
                  name: data.name || `Scenario ${id}`,
                  description: data.description,
                  status: data.status || 'active',
                  created_at: data.created_at,
                  updated_at: data.updated_at,
                };

                if (data.slots) {
                  scenario.steps = data.slots.map((slot: any, index: number) => ({
                    id: slot.id,
                    name: `Slot ${index}`,
                    type: 'slot',
                    status: 'pending',
                    actions: slot.actions,
                  }));
                }

                return scenario;
              });

              setScenarios(loadedScenarios);
            } catch (error) {
              console.error('Error parsing saved scenarios:', error);
              setScenarios([]);
            }
          } else {
            setScenarios([]);
          }
        } else {
          setScenarios([]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadScenarios();
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

  return <ScenariosBento scenarios={scenarios} />;
}
