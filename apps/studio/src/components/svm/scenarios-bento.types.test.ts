import { describe, expect, it } from 'vitest';
import { exampleScenarios } from './scenarios-bento.types';

// Goal-level prompts only: a template id, tool name, slot or flag here rots on the next backend rename.
const IMPLEMENTATION_LEAKS = [
  'raydium-clmm-pool-state',
  'raydium-amm-pool-state',
  'raydium-clmm-amm-config',
  'create_raydium_clmm_price_shock_scenario',
  'create_scenario',
  'scenarioRelativeSlot',
  'fetchBeforeUse',
  'slot 1',
  'slot 0',
];

describe('Raydium example scenarios', () => {
  const poolFreeze = exampleScenarios.find((scenario) => scenario.label === 'Raydium Pool Freeze');
  const clmmPriceShock = exampleScenarios.find((scenario) => scenario.label === 'Raydium CLMM Price Shock');

  it('lists a Raydium Pool Freeze chip tagged to the raydium protocol with the v4 pool address', () => {
    expect(poolFreeze).toBeDefined();
    expect(poolFreeze!.protocols).toEqual(['raydium']);
    expect(poolFreeze!.prompt).toContain('58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2');
  });

  it('lists a Raydium CLMM Price Shock chip tagged to the raydium protocol with the CLMM pool address', () => {
    expect(clmmPriceShock).toBeDefined();
    expect(clmmPriceShock!.protocols).toEqual(['raydium']);
    expect(clmmPriceShock!.prompt).toContain('3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv');
  });

  it('keeps both Raydium prompts free of template ids, tool names, slots and flags', () => {
    for (const scenario of [poolFreeze!, clmmPriceShock!]) {
      for (const leak of IMPLEMENTATION_LEAKS) {
        expect(scenario.prompt).not.toContain(leak);
      }
    }
  });
});
