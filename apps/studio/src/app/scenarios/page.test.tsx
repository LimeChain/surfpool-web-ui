import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithConfig } from '@/test-utils';
import Scenarios from './page';

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Lightweight stub so the tests drive the page's refresh state machine
// (loader, defer/flush, error notice) without rendering the full bento tree.
vi.mock('@/components/svm/scenarios-bento', () => ({
  default: ({ scenarios, onRefresh, onDetailPaneChange }: any) => (
    <div>
      <ul>
        {scenarios.map((s: any) => (
          <li key={s.id}>{s.name}</li>
        ))}
      </ul>
      <button onClick={() => onRefresh?.()}>refresh</button>
      <button onClick={() => onDetailPaneChange?.(true)}>open-pane</button>
      <button onClick={() => onDetailPaneChange?.(false)}>close-pane</button>
    </div>
  ),
}));

const okResponse = (items: Array<{ id: string; name: string }>) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(items),
});

const failResponse = () => ({ ok: false, status: 500, text: async () => '' });

describe('scenarios page refresh state machine', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the loader on first load, then the list', async () => {
    (global.fetch as any).mockResolvedValue(okResponse([{ id: 'a', name: 'Alpha' }]));

    renderWithConfig(<Scenarios />);

    expect(screen.getByText(/Loading scenarios/i)).toBeInTheDocument();
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
  });

  it('refreshes in the background without blanking the list', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(okResponse([{ id: 'a', name: 'Alpha' }]))
      .mockResolvedValueOnce(okResponse([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }]));

    renderWithConfig(<Scenarios />);
    await screen.findByText('Alpha');

    fireEvent.click(screen.getByText('refresh'));

    // The full-screen loader must not reappear during a background refetch.
    expect(screen.queryByText(/Loading scenarios/i)).not.toBeInTheDocument();
    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('defers a refresh while the pane is open and flushes exactly once on close', async () => {
    (global.fetch as any).mockResolvedValue(okResponse([{ id: 'a', name: 'Alpha' }]));

    renderWithConfig(<Scenarios />);
    await screen.findByText('Alpha');
    const callsAfterLoad = (global.fetch as any).mock.calls.length;

    fireEvent.click(screen.getByText('open-pane'));
    act(() => {
      window.dispatchEvent(new Event('scenarioUpdated'));
      window.dispatchEvent(new Event('scenarioUpdated'));
    });

    // Deferred: no refetch fires while the detail pane is open.
    expect((global.fetch as any).mock.calls.length).toBe(callsAfterLoad);

    fireEvent.click(screen.getByText('close-pane'));

    await waitFor(() => {
      expect((global.fetch as any).mock.calls.length).toBe(callsAfterLoad + 1);
    });
  });

  it('keeps the list and shows a notice when a background refresh fails', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(okResponse([{ id: 'a', name: 'Alpha' }]))
      .mockResolvedValueOnce(failResponse());

    renderWithConfig(<Scenarios />);
    await screen.findByText('Alpha');

    fireEvent.click(screen.getByText('refresh'));

    expect(await screen.findByText(/Couldn't refresh/i)).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('clears the notice and reloads when the failed refresh is retried', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(okResponse([{ id: 'a', name: 'Alpha' }]))
      .mockResolvedValueOnce(failResponse())
      .mockResolvedValueOnce(okResponse([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }]));

    renderWithConfig(<Scenarios />);
    await screen.findByText('Alpha');

    fireEvent.click(screen.getByText('refresh'));
    await screen.findByText(/Couldn't refresh/i);

    fireEvent.click(screen.getByText('Retry'));

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't refresh/i)).not.toBeInTheDocument();
  });
});
