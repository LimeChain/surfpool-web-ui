import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSurfnetClockSeconds } from './surfnet-clock';

const mockFetchResponse = (response: Partial<Response> & { json?: () => Promise<unknown> }) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, ...response });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchSurfnetClockSeconds', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the clock unix timestamp in seconds', async () => {
    const fetchMock = mockFetchResponse({
      json: async () => ({
        result: { value: { data: { parsed: { info: { unixTimestamp: 1785758170 } } } } },
      }),
    });

    await expect(fetchSurfnetClockSeconds('http://127.0.0.1:8899')).resolves.toBe(1785758170);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8899');
    const body = JSON.parse(options.body);
    expect(body.method).toBe('getAccountInfo');
    expect(body.params[0]).toBe('SysvarC1ock11111111111111111111111111111111');
    expect(body.params[1]).toEqual({ encoding: 'jsonParsed' });
  });

  it('returns null on a non-ok HTTP response', async () => {
    mockFetchResponse({ ok: false });
    await expect(fetchSurfnetClockSeconds('http://127.0.0.1:8899')).resolves.toBeNull();
  });

  it('returns null when the request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchSurfnetClockSeconds('http://127.0.0.1:8899')).resolves.toBeNull();
  });

  it('returns null when the account is missing', async () => {
    mockFetchResponse({ json: async () => ({ result: { value: null } }) });
    await expect(fetchSurfnetClockSeconds('http://127.0.0.1:8899')).resolves.toBeNull();
  });

  it('returns null when the timestamp is not numeric', async () => {
    mockFetchResponse({
      json: async () => ({
        result: { value: { data: { parsed: { info: { unixTimestamp: 'not-a-number' } } } } },
      }),
    });
    await expect(fetchSurfnetClockSeconds('http://127.0.0.1:8899')).resolves.toBeNull();
  });

  it('returns null when the timestamp is null', async () => {
    mockFetchResponse({
      json: async () => ({
        result: { value: { data: { parsed: { info: { unixTimestamp: null } } } } },
      }),
    });
    await expect(fetchSurfnetClockSeconds('http://127.0.0.1:8899')).resolves.toBeNull();
  });
});
