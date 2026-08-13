import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSurfnetClockSeconds, startSurfnetClockPolling } from './surfnet-clock';

const mockFetchResponse = (response: Partial<Response> & { json?: () => Promise<unknown> }) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, ...response });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchSurfnetClockSeconds', () => {
  afterEach(() => {
    vi.useRealTimers();
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

  it('does not start another poll while the current request is pending', async () => {
    vi.useFakeTimers();
    let resolveFirstRequest: ((response: Partial<Response>) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRequest = resolve;
          })
      )
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          result: { value: { data: { parsed: { info: { unixTimestamp: 1785758171 } } } } },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const onUpdate = vi.fn();

    const stop = startSurfnetClockPolling('http://127.0.0.1:8899', onUpdate);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFirstRequest?.({
      ok: true,
      json: async () => ({
        result: { value: { data: { parsed: { info: { unixTimestamp: 1785758170 } } } } },
      }),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(onUpdate).toHaveBeenCalledWith(1785758170);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stop();
  });
});
