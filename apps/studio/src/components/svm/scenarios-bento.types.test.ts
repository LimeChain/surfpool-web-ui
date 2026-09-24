import { describe, expect, it } from 'vitest';
import { exampleScenarios } from './scenarios-bento.types';

// Goal-level prompts only: a template id, tool name, slot or flag here rots on the next backend rename.
const IMPLEMENTATION_LEAKS = [
  'whirlpool-pool-state',
  'create_whirlpool_price_shock_scenario',
  'create_scenario',
  'scenarioRelativeSlot',
  'fetchBeforeUse',
  'slot 1',
  'slot 0',
];

describe('Whirlpool example scenarios', () => {
  const priceShock = exampleScenarios.find((scenario) => scenario.label === 'Whirlpool Price Shock');

  it('lists a Whirlpool Price Shock chip tagged to the whirlpool protocol with the SOL/USDC pool address', () => {
    expect(priceShock).toBeDefined();
    expect(priceShock!.protocols).toEqual(['whirlpool']);
    expect(priceShock!.prompt).toContain('Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE');
  });

  it('keeps the Whirlpool prompt free of template ids, tool names, slots and flags', () => {
    for (const leak of IMPLEMENTATION_LEAKS) {
      expect(priceShock!.prompt).not.toContain(leak);
    }
  });
});
