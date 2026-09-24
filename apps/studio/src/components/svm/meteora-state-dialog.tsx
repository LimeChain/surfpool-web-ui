'use client';

import { createMeteoraPairHaltScenario, createMeteoraPriceShockScenario } from '@/lib/scenarios-api';
import { Button, Dialog, DialogActions, DialogDescription, DialogTitle, Input, Listbox, ListboxOption } from '@surfpool/ui';
import { type ChangeEvent, type FormEvent, useState } from 'react';

const MeteoraStateMode = {
  PriceShock: 'price-shock',
  PairHalt: 'pair-halt',
} as const;

type MeteoraStateMode = (typeof MeteoraStateMode)[keyof typeof MeteoraStateMode];

const MeteoraStateModeLabel: Record<MeteoraStateMode, string> = {
  [MeteoraStateMode.PriceShock]: 'Price shock',
  [MeteoraStateMode.PairHalt]: 'Pair halt',
};

const meteoraStateModes = Object.values(MeteoraStateMode);

// The SOL/USDC pair, so the dialog opens with a valid address already filled.
const DEFAULT_DLMM_POOL = 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y';

interface MeteoraStateDialogProps {
  open: boolean;
  studioUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderStateModeOption = (stateMode: MeteoraStateMode) => (
  <ListboxOption key={stateMode} value={stateMode}>
    {MeteoraStateModeLabel[stateMode]}
  </ListboxOption>
);

export default function MeteoraStateDialog({ open, studioUrl, onClose, onCreated }: MeteoraStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<MeteoraStateMode>(MeteoraStateMode.PriceShock);
  const [pool, setPool] = useState(DEFAULT_DLMM_POOL);
  const [priceFactor, setPriceFactor] = useState('0.5');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // DERIVED STATE
  const priceFactorNumber = Number(priceFactor.trim());
  const hasValidPriceFactor = Number.isFinite(priceFactorNumber) && priceFactorNumber > 0 && priceFactorNumber !== 1;
  const canCreate =
    !isCreating &&
    !!pool.trim() &&
    (mode === MeteoraStateMode.PriceShock ? hasValidPriceFactor : true);

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleModeChange = (selectedMode: MeteoraStateMode) => {
    setMode(selectedMode);
    setPool(selectedMode === MeteoraStateMode.PriceShock ? DEFAULT_DLMM_POOL : '');
    setError(null);
  };

  const handlePoolChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPool(event.target.value);
    setError(null);
  };

  const handlePriceFactorChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPriceFactor(event.target.value);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const result =
        mode === MeteoraStateMode.PriceShock
          ? await createMeteoraPriceShockScenario(studioUrl, pool, priceFactor)
          : await createMeteoraPairHaltScenario(studioUrl, pool);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create Meteora state scenario');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create Meteora state scenario</DialogTitle>
        <DialogDescription>
          Prepare Meteora DLMM pair state for bots to trade, arbitrage, or route around. Surfpool does not execute
          their transactions.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">State goal</span>
            <Listbox aria-label="State goal" value={mode} onChange={handleModeChange} disabled={isCreating}>
              {meteoraStateModes.map(renderStateModeOption)}
            </Listbox>
          </div>

          <div>
            <label htmlFor="meteora-pool" className="mb-1.5 block text-sm font-medium text-zinc-300">
              DLMM pair
            </label>
            <Input
              id="meteora-pool"
              aria-label="Meteora DLMM pair"
              placeholder="LbPair address"
              value={pool}
              onChange={handlePoolChange}
              disabled={isCreating}
            />
          </div>

          {mode === MeteoraStateMode.PriceShock && (
            <div>
              <label htmlFor="meteora-price-factor" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Price factor
              </label>
              <Input
                id="meteora-price-factor"
                aria-label="Price factor"
                placeholder="0.5 halves the price, 4 quadruples it"
                value={priceFactor}
                onChange={handlePriceFactorChange}
                disabled={isCreating}
              />
            </div>
          )}
          {!!error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <DialogActions>
          <Button type="button" color="dark" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" color="pink" disabled={!canCreate}>
            {isCreating ? 'Creating…' : 'Create scenario'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
