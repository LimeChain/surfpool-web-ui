import { describe, expect, it } from 'vitest';
import { exampleScenarios } from './scenarios-bento.types';

// Goal-level prompts only: a template id, tool name, slot or flag here rots on the next backend rename.
const IMPLEMENTATION_LEAKS = [
  'meteora-dlmm-pool-state',
  'create_meteora_price_shock_scenario',
  'create_scenario',
  'scenarioRelativeSlot',
  'fetchBeforeUse',
  'slot 1',
  'slot 0',
];

describe('Meteora example scenarios', () => {
  const pairHalt = exampleScenarios.find((scenario) => scenario.label === 'Meteora Pair Halt');
  const priceShock = exampleScenarios.find((scenario) => scenario.label === 'Meteora Price Shock');

  it('lists a Meteora Pair Halt chip tagged to the meteora protocol with the SOL/USDC pair address', () => {
    expect(pairHalt).toBeDefined();
    expect(pairHalt!.protocols).toEqual(['meteora']);
    expect(pairHalt!.prompt).toContain('BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y');
  });

  it('lists a Meteora Price Shock chip tagged to the meteora protocol with the SOL/USDC pair address', () => {
    expect(priceShock).toBeDefined();
    expect(priceShock!.protocols).toEqual(['meteora']);
    expect(priceShock!.prompt).toContain('BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y');
  });

  it('keeps both Meteora prompts free of template ids, tool names, slots and flags', () => {
    for (const scenario of [pairHalt!, priceShock!]) {
      for (const leak of IMPLEMENTATION_LEAKS) {
        expect(scenario.prompt).not.toContain(leak);
      }
    }
  });
});
