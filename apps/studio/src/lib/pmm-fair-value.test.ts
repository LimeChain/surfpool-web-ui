import { LosslessNumber } from 'lossless-json';
import { describe, expect, it, vi } from 'vitest';
import { createTemplateScenario } from './pmm-fair-value';

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
