'use client';

import { useEffect, useState } from 'react';
import ScenariosBento from '@/components/svm/scenarios-bento';
import { Scenario } from '@/pages/api/scenarios';

export default function Scenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScenarios() {
      try {
        const response = await fetch('/api/scenarios');
        if (!response.ok) {
          throw new Error('Failed to fetch scenarios');
        }
        const data = await response.json();
        setScenarios(data.scenarios);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchScenarios();
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
