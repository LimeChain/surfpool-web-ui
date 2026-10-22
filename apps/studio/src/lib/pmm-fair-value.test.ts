import { LosslessNumber } from 'lossless-json';
import { describe, expect, it, vi } from 'vitest';
import { createTemplateScenario, goonfiPriceX1e6 } from './pmm-fair-value';

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
