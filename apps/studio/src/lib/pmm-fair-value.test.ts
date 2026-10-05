import { describe, expect, it } from 'vitest';
import { tesseraPriceRatios } from './pmm-fair-value';

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
