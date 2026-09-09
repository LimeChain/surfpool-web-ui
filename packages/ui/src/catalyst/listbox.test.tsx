import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Listbox, ListboxOption } from './listbox';

const handleChange = () => undefined;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const installResizeObserver = () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
};

const restoreGlobals = () => {
  vi.unstubAllGlobals();
};

describe('Listbox', () => {
  beforeAll(installResizeObserver);
  afterAll(restoreGlobals);

  it('keeps long option lists anchored and viewport constrained', async () => {
    render(
      <Listbox defaultValue="BTC" onChange={handleChange} aria-label="Market">
        <ListboxOption value="BTC">BTC</ListboxOption>
        <ListboxOption value="SOL">SOL</ListboxOption>
      </Listbox>
    );

    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Market' }), {
        key: 'ArrowDown',
      });
    });

    const options = screen.getByRole('listbox');
    expect(options.getAttribute('data-anchor')).toMatch(/^(top|bottom) (start|end)$/);
    expect(options.className).toContain('max-h-64');
    expect(options.className).toContain('w-[var(--button-width)]');
    expect(options.className).not.toContain('top-full');
  });
});
