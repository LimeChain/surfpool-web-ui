import { LosslessNumber } from 'lossless-json';
import { describe, expect, it, vi } from 'vitest';
import { createTemplateScenario, tesseraPriceRatios } from './pmm-fair-value';

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

  it('keeps a ratio above u64 exact', () => {
    expect(tesseraPriceRatios('0.00000001', 9, 6)).toEqual({
      quoteAtomsPerBaseAtomX1e15: BigInt('10000'),
      baseAtomsPerQuoteAtomX1e15: BigInt('100000000000000000000000000'),
    });
  });

  it('rejects a price whose reverse ratio rounds to zero', () => {
    expect(() => tesseraPriceRatios('100000000000000000', 6, 6)).toThrow('too large');
  });

  it('accepts as many decimals as the market ratio holds and rejects one more', () => {
    expect(tesseraPriceRatios('100.000000000001', 9, 6).quoteAtomsPerBaseAtomX1e15).toBe(BigInt('100000000000001'));
    expect(() => tesseraPriceRatios('100.0000000000001', 9, 6)).toThrow(
      'Price has more decimals than this market supports, at most 12'
    );
  });
});

describe('createTemplateScenario', () => {
  it('posts the scenario losslessly and returns its id', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'scenario-id' }) }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createTemplateScenario('http://studio', { id: 'scenario-id', value: new LosslessNumber('9975062344139650') })
    ).resolves.toEqual({ id: 'scenario-id' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://studio/v1/scenarios');
    expect(init).toMatchObject({ method: 'POST', body: '{"id":"scenario-id","value":9975062344139650}' });
    vi.unstubAllGlobals();
  });
});
