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
        onWhirlpoolStateSelect={vi.fn()}
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
        onWhirlpoolStateSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /PumpSwap price shock/i }));

    expect(onPumpSwapPriceShockSelect).toHaveBeenCalledOnce();
  });

  it('opens the Whirlpool state preset', () => {
    const onWhirlpoolStateSelect = vi.fn();

    render(
      <ScenarioPresets
        onPumpGraduationSelect={vi.fn()}
        onPumpSwapPriceShockSelect={vi.fn()}
        onWhirlpoolStateSelect={onWhirlpoolStateSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Whirlpool state/i }));

    expect(onWhirlpoolStateSelect).toHaveBeenCalledOnce();
  });
});
