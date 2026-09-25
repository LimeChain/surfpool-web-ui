import { describe, expect, it } from 'vitest';
import {
  buildPmmFairValueScenario,
  humidifiFairValue,
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

  it('assembles the HumidiFi fair value scenario for WSOL/USDC at 208', () => {
    const market = {
      label: 'WSOL / USDC',
      value: '8sKQHfjNhvmAw94PhfvfMcytmqW6jmxvwieYyzXCCPu',
      metadata: { pair: 'WSOL/USDC', base_decimals: 9, quote_decimals: 6 },
    };
    const scenario = buildPmmFairValueScenario(PMM_FAIR_VALUE_ADAPTERS[PmmProtocols.HumidiFi], market, '208');
    const shared = { account: { pubkey: market.value }, scenarioRelativeSlot: 0, enabled: true, fetchBeforeUse: true };

    expect(scenario).toMatchObject({
      name: 'HumidiFi WSOL / USDC fair value 208',
      description: 'Set the HumidiFi WSOL / USDC fair value to 208 and keep the quote fresh.',
      tags: ['humidifi', 'pmm', 'fair-value'],
      overrides: [
        { ...shared, templateId: 'humidifi-price', values: { fair_value: toScenarioNumber('58546795155816') } },
        { ...shared, templateId: 'humidifi-freshness', values: { last_update_slot: 0 } },
      ],
    });
    expect(scenario.overrides).toHaveLength(2);
    expect(new Set(scenario.overrides.map(({ id }) => id)).size).toBe(2);
  });
});

describe('humidifiFairValue', () => {
  it.each([
    ['208', 9, 6, BigInt('58546795155816')],
    ['100', 9, 6, BigInt('28147497671065')],
    ['1', 6, 6, BigInt('281474976710656')],
    ['0.5', 6, 8, BigInt('14073748835532800')],
  ])('derives the fair value for %s at %i/%i decimals', (price, base, quote, expected) => {
    expect(humidifiFairValue(price, base, quote)).toBe(expected);
  });

  it('rejects a price whose fair value leaves the u64 range', () => {
    expect(() => humidifiFairValue('0.0000000000001', 9, 6)).toThrow('too small');
    expect(() => humidifiFairValue('1000000000', 6, 6)).toThrow('too large');
  });
});
