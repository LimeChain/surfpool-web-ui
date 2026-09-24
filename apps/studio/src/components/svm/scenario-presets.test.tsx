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
        onMeteoraStateSelect={vi.fn()}
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
        onMeteoraStateSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /PumpSwap price shock/i }));

    expect(onPumpSwapPriceShockSelect).toHaveBeenCalledOnce();
  });

  it('opens the Meteora state preset', () => {
    const onMeteoraStateSelect = vi.fn();

    render(
      <ScenarioPresets
        onPumpGraduationSelect={vi.fn()}
        onPumpSwapPriceShockSelect={vi.fn()}
        onMeteoraStateSelect={onMeteoraStateSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Meteora state/i }));

    expect(onMeteoraStateSelect).toHaveBeenCalledOnce();
  });
});
