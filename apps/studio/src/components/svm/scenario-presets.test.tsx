import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ScenarioPresets from './scenario-presets';

describe('ScenarioPresets', () => {
  it('opens the Pump graduation preset', () => {
    const onPumpGraduationSelect = vi.fn();

    render(
      <ScenarioPresets
        onPumpGraduationSelect={onPumpGraduationSelect}
        onPumpSwapPriceShockSelect={vi.fn()}
        onPhoenixStateSelect={vi.fn()}
        onPancakeswapStateSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Pump graduation/i }));

    expect(onPumpGraduationSelect).toHaveBeenCalledOnce();
  });

  it('opens the PumpSwap price shock preset', () => {
    const onPumpSwapPriceShockSelect = vi.fn();

    render(
      <ScenarioPresets
        onPumpGraduationSelect={vi.fn()}
        onPumpSwapPriceShockSelect={onPumpSwapPriceShockSelect}
        onPhoenixStateSelect={vi.fn()}
        onPancakeswapStateSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /PumpSwap price shock/i }));

    expect(onPumpSwapPriceShockSelect).toHaveBeenCalledOnce();
  });

  it('opens the Phoenix state preset', () => {
    const onPhoenixStateSelect = vi.fn();

    render(
      <ScenarioPresets
        onPumpGraduationSelect={vi.fn()}
        onPumpSwapPriceShockSelect={vi.fn()}
        onPhoenixStateSelect={onPhoenixStateSelect}
        onPancakeswapStateSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Phoenix state/i }));

    expect(onPhoenixStateSelect).toHaveBeenCalledOnce();
  });

  it('opens the PancakeSwap state preset', () => {
    const onPancakeswapStateSelect = vi.fn();

    render(
      <ScenarioPresets
        onPumpGraduationSelect={vi.fn()}
        onPumpSwapPriceShockSelect={vi.fn()}
        onPhoenixStateSelect={vi.fn()}
        onPancakeswapStateSelect={onPancakeswapStateSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /PancakeSwap state/i }));

    expect(onPancakeswapStateSelect).toHaveBeenCalledOnce();
  });
});
