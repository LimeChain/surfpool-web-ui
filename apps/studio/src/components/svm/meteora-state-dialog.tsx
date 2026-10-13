'use client';

import {
  createMeteoraDammV2FeeScenario,
  createMeteoraDammV2PriceShockScenario,
  createMeteoraPairHaltScenario,
  createMeteoraPriceShockScenario,
} from '@/lib/scenarios-api';
import {
  Button,
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
  Input,
  Listbox,
  ListboxOption,
} from '@surfpool/ui';
import { type ChangeEvent, type FormEvent, useState } from 'react';

const MeteoraStateMode = {
  PriceShock: 'price-shock',
  PairHalt: 'pair-halt',
  DammV2PriceShock: 'damm-v2-price-shock',
  DammV2Fee: 'damm-v2-fee',
} as const;

type MeteoraStateMode = (typeof MeteoraStateMode)[keyof typeof MeteoraStateMode];

const MeteoraStateModeLabel: Record<MeteoraStateMode, string> = {
  [MeteoraStateMode.PriceShock]: 'DLMM price shock',
  [MeteoraStateMode.PairHalt]: 'DLMM pair halt',
  [MeteoraStateMode.DammV2PriceShock]: 'DAMM v2 price shock',
  [MeteoraStateMode.DammV2Fee]: 'DAMM v2 fee',
};

const meteoraStateModes = Object.values(MeteoraStateMode);

interface MeteoraStateDialogProps {
  open: boolean;
  studioUrl: string;
  rpcUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderStateModeOption = (stateMode: MeteoraStateMode) => (
  <ListboxOption key={stateMode} value={stateMode}>
    {MeteoraStateModeLabel[stateMode]}
  </ListboxOption>
);

export default function MeteoraStateDialog({ open, studioUrl, rpcUrl, onClose, onCreated }: MeteoraStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<MeteoraStateMode>(MeteoraStateMode.PriceShock);
  const [pool, setPool] = useState('');
  const [priceFactor, setPriceFactor] = useState('');
  const [feeBps, setFeeBps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // DERIVED STATE
  const priceFactorNumber = Number(priceFactor.trim());
  const hasValidPriceFactor = Number.isFinite(priceFactorNumber) && priceFactorNumber > 0 && priceFactorNumber !== 1;
  const feeBpsNumber = Number(feeBps.trim());
  const hasValidFeeBps = Number.isInteger(feeBpsNumber) && feeBpsNumber >= 1 && feeBpsNumber <= 5000;
  const isFee = mode === MeteoraStateMode.DammV2Fee;
  const isDammV2 = mode === MeteoraStateMode.DammV2PriceShock || isFee;
  const isPriceShock = mode === MeteoraStateMode.PriceShock || mode === MeteoraStateMode.DammV2PriceShock;
  const poolKind = isDammV2 ? 'DAMM v2 pool' : 'DLMM pair';
  const canCreate =
    !isCreating && !!pool.trim() && (isPriceShock ? hasValidPriceFactor : isFee ? hasValidFeeBps : true);

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleModeChange = (selectedMode: MeteoraStateMode) => {
    setMode(selectedMode);
    setPool('');
    setError(null);
  };

  const handleChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value);
    setError(null);
  };
  const handlePoolChange = handleChange(setPool);
  const handlePriceFactorChange = handleChange(setPriceFactor);
  const handleFeeBpsChange = handleChange(setFeeBps);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const result =
        mode === MeteoraStateMode.PriceShock
          ? await createMeteoraPriceShockScenario(studioUrl, rpcUrl, pool, priceFactor)
          : mode === MeteoraStateMode.DammV2PriceShock
            ? await createMeteoraDammV2PriceShockScenario(studioUrl, rpcUrl, pool, priceFactor)
            : isFee
              ? await createMeteoraDammV2FeeScenario(studioUrl, rpcUrl, pool, feeBps)
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
          Prepare Meteora DLMM pair or DAMM v2 pool state for bots to trade, arbitrage, or route around. Surfpool does
          not execute their transactions.
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
              {poolKind}
            </label>
            <Input
              id="meteora-pool"
              aria-label={`Meteora ${poolKind}`}
              placeholder={`Address of the Meteora ${poolKind}`}
              value={pool}
              onChange={handlePoolChange}
              disabled={isCreating}
            />
          </div>

          {isPriceShock && (
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
              <p className="mt-1.5 text-sm text-zinc-400">
                {isDammV2
                  ? 'The vaults keep their balances, so a large swap paying out of the raised side can fail.'
                  : 'Only one side sees the shock: buys of the base token after a rise, sells after a drop.'}
              </p>
            </div>
          )}
          {isFee && (
            <div>
              <label htmlFor="meteora-fee-bps" className="mb-1.5 block text-sm font-medium text-zinc-300">
                Base fee (bps)
              </label>
              <Input
                id="meteora-fee-bps"
                aria-label="Base fee (bps)"
                placeholder="500 is 5%, up to 5000"
                value={feeBps}
                onChange={handleFeeBpsChange}
                disabled={isCreating}
              />
              <p className="mt-1.5 text-sm text-zinc-400">
                The pool keeps this base fee flat; its variable fee still adds on top.
              </p>
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
