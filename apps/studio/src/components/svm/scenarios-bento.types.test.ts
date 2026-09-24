import { describe, expect, it } from 'vitest';
import { exampleScenarios } from './scenarios-bento.types';

// Goal-level prompts only: a template id, tool name, slot or flag here rots on the next backend rename.
const IMPLEMENTATION_LEAKS = [
  'pancakeswap-clmm-pool-state',
  'pancakeswap-clmm-amm-config',
  'pancakeswap-clmm-custom',
  'create_pancakeswap_price_shock_scenario',
  'create_scenario',
  'scenarioRelativeSlot',
  'fetchBeforeUse',
  'slot 1',
  'slot 0',
];

describe('PancakeSwap example scenarios', () => {
  const feeSpike = exampleScenarios.find((scenario) => scenario.label === 'PancakeSwap Fee Spike');
  const priceShock = exampleScenarios.find((scenario) => scenario.label === 'PancakeSwap Price Shock');

  it('lists a PancakeSwap Fee Spike chip tagged to the pancakeswap protocol with the fee tier config address', () => {
    expect(feeSpike).toBeDefined();
    expect(feeSpike!.protocols).toEqual(['pancakeswap']);
    expect(feeSpike!.prompt).toContain('G3BrCQzNu93v1acayMA23CmCMH8tf6iAFb3PYUHUHtcg');
  });

  it('lists a PancakeSwap Price Shock chip tagged to the pancakeswap protocol with the pool address', () => {
    expect(priceShock).toBeDefined();
    expect(priceShock!.protocols).toEqual(['pancakeswap']);
    expect(priceShock!.prompt).toContain('DJNtGuBGEQiUCWE8F981M2C3ZghZt2XLD8f2sQdZ6rsZ');
  });

  it('keeps both PancakeSwap prompts free of template ids, tool names, slots and flags', () => {
    for (const scenario of [feeSpike!, priceShock!]) {
      for (const leak of IMPLEMENTATION_LEAKS) {
        expect(scenario.prompt).not.toContain(leak);
      }
    }
  });
});
