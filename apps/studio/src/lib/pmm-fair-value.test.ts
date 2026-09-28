import { describe, expect, it } from 'vitest';
import {
  buildPmmFairValueScenario,
  goonfiPriceX1e6,
  PMM_FAIR_VALUE_ADAPTERS,
  PmmProtocols,
  tesseraPriceRatios,
} from './pmm-fair-value';
import { toScenarioNumber } from './scenarios-api';

describe('tesseraPriceRatios', () => {
  it.each([
    ['100', 9, 6, BigInt('100000000000000'), BigInt('10000000000000000')],
    ['100000', 8, 6, BigInt('1000000000000000000'), BigInt('1000000000000')],
    ['100.25', 9, 6, BigInt('100250000000000'), BigInt('9975062344139650')],
  ])('derives both ratios for %s at %i/%i decimals', (price, base, quote, quoteX1e15, baseX1e15) => {
    expect(tesseraPriceRatios(price, base, quote)).toEqual({
      quoteAtomsPerBaseAtomX1e15: quoteX1e15,
      baseAtomsPerQuoteAtomX1e15: baseX1e15,
    });
  });

  it('rejects a price whose ratios leave the u64 range', () => {
    expect(() => tesseraPriceRatios('0.00000001', 9, 6)).toThrow('too small');
    expect(() => tesseraPriceRatios('100000000000000000', 6, 6)).toThrow('too large');
  });

  it('accepts as many decimals as the market ratio holds and rejects one more', () => {
    expect(tesseraPriceRatios('100.000000000001', 9, 6).quoteAtomsPerBaseAtomX1e15).toBe(BigInt('100000000000001'));
    expect(() => tesseraPriceRatios('100.0000000000001', 9, 6)).toThrow(
      'Price has more decimals than this market supports, at most 12'
    );
  });
});

describe('buildPmmFairValueScenario', () => {
  it('assembles the Tessera fair value scenario for WSOL/USDC at $100', () => {
    const market = {
      label: 'WSOL / USDC',
      value: 'FLckHLGMJy5gEoXWwcE68Nprde1D4araK4TGLw4pQq2n',
      metadata: { pair: 'WSOL/USDC', base_decimals: 9, quote_decimals: 6 },
    };
    const scenario = buildPmmFairValueScenario(PMM_FAIR_VALUE_ADAPTERS[PmmProtocols.Tessera], market, ' 100 ');
    const shared = { account: { pubkey: market.value }, scenarioRelativeSlot: 0, enabled: true, fetchBeforeUse: true };

    expect(scenario).toMatchObject({
      name: 'Tessera WSOL / USDC fair value 100',
      description: 'Set the Tessera WSOL / USDC fair value to 100 and keep the quote fresh.',
      tags: ['tessera', 'pmm', 'fair-value'],
      overrides: [
        {
          ...shared,
          templateId: 'tessera-price',
          values: {
            quote_atoms_per_base_atom_x1e15: toScenarioNumber('100000000000000'),
            base_atoms_per_quote_atom_x1e15: toScenarioNumber('10000000000000000'),
          },
        },
        { ...shared, templateId: 'tessera-freshness', values: { last_update_slot: 0 } },
      ],
    });
    expect(scenario.overrides).toHaveLength(2);
    expect(new Set(scenario.overrides.map(({ id }) => id)).size).toBe(2);
  });

  it('assembles the GoonFi fair value scenario for SOL/USDC at $150', () => {
    const market = {
      label: 'SOL / USDC',
      value: 'GMCJvYGf5Ex2ARiMquaBDqU6iKM8uiEQkB8jCnoNfHpC',
      metadata: { pair: 'SOL/USDC', oracle: '7yecFG22heommABQ5svcbQLK1Ua4ZrJsHPiktZ17jfm3' },
    };
    const scenario = buildPmmFairValueScenario(PMM_FAIR_VALUE_ADAPTERS[PmmProtocols.GoonFi], market, '150');
    const shared = { scenarioRelativeSlot: 0, enabled: true, fetchBeforeUse: true };
    const oracle = { pubkey: market.metadata.oracle };

    expect(scenario).toMatchObject({
      name: 'GoonFi SOL / USDC fair value 150',
      description: 'Set the GoonFi SOL / USDC fair value to 150 and keep the quote fresh.',
      tags: ['goonfi', 'pmm', 'fair-value'],
      overrides: [
        {
          ...shared,
          templateId: 'goonfi-price',
          account: oracle,
          values: { bid_price_x1e6: 150000000, ask_price_x1e6: 150000000 },
        },
        { ...shared, templateId: 'goonfi-freshness', account: oracle, values: { last_update_slot: 0 } },
        {
          ...shared,
          templateId: 'goonfi-reference-band',
          account: { pubkey: market.value },
          values: { reference_price_a_x1e6: 150000000, reference_price_b_x1e6: 150000000 },
        },
      ],
    });
    expect(scenario.overrides).toHaveLength(3);
    expect(new Set(scenario.overrides.map(({ id }) => id)).size).toBe(3);
  });
});

describe('goonfiPriceX1e6', () => {
  it.each([
    ['99.74', BigInt('99740000')],
    ['1.0001', BigInt('1000100')],
    ['150', BigInt('150000000')],
  ])('scales %s to quote per base times 10^6', (price, expected) => {
    expect(goonfiPriceX1e6(price)).toBe(expected);
  });

  it('accepts up to u64 max with 6 decimals and rejects anything beyond', () => {
    expect(goonfiPriceX1e6('18446744073709.551615')).toBe(BigInt('18446744073709551615'));
    expect(() => goonfiPriceX1e6('18446744073710')).toThrow('too large');
    expect(() => goonfiPriceX1e6('1.0000001')).toThrow('at most 6');
  });
});
