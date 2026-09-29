'use client';

import { createWhirlpoolFeeRateScenario, createWhirlpoolPriceShockScenario } from '@/lib/scenarios-api';
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
import { type ChangeEvent, type ComponentProps, type FormEvent, useState } from 'react';

const WhirlpoolStateMode = {
  PriceShock: 'price-shock',
  FeeRate: 'fee-rate',
} as const;

type WhirlpoolStateMode = (typeof WhirlpoolStateMode)[keyof typeof WhirlpoolStateMode];

const WhirlpoolStateModeLabel: Record<WhirlpoolStateMode, string> = {
  [WhirlpoolStateMode.PriceShock]: 'Price shock',
  [WhirlpoolStateMode.FeeRate]: 'Fee rate',
};

// The SOL/USDC pool, so the dialog opens with a valid address already filled.
const DEFAULT_WHIRLPOOL_POOL = 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE';

// fee_rate is capped at 60000 hundredths of a bp (6%), so plain bps stop at 600.
const MAX_FEE_BPS = 600;

interface WhirlpoolDialogProps {
  open: boolean;
  studioUrl: string;
  rpcUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

type FieldProps = ComponentProps<typeof Input> & { id: string; label: string; ariaLabel?: string };

function Field({ id, label, ariaLabel = label, ...inputProps }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-300">
        {label}
      </label>
      <Input id={id} aria-label={ariaLabel} {...inputProps} />
    </div>
  );
}

const renderStateModeOption = (stateMode: WhirlpoolStateMode) => (
  <ListboxOption key={stateMode} value={stateMode}>
    {WhirlpoolStateModeLabel[stateMode]}
  </ListboxOption>
);

export default function WhirlpoolStateDialog({ open, studioUrl, rpcUrl, onClose, onCreated }: WhirlpoolDialogProps) {
  // STATE
  const [mode, setMode] = useState<WhirlpoolStateMode>(WhirlpoolStateMode.PriceShock);
  const [pool, setPool] = useState(DEFAULT_WHIRLPOOL_POOL);
  const [priceFactor, setPriceFactor] = useState('0.5');
  const [feeBps, setFeeBps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // DERIVED STATE
  const priceFactorNumber = Number(priceFactor.trim());
  const hasValidPriceFactor = Number.isFinite(priceFactorNumber) && priceFactorNumber > 0 && priceFactorNumber !== 1;
  const hasValidFeeBps = /^\d+$/.test(feeBps.trim()) && Number(feeBps.trim()) < MAX_FEE_BPS;
  const isPriceShock = mode === WhirlpoolStateMode.PriceShock;
  const canCreate = !isCreating && !!pool.trim() && (isPriceShock ? hasValidPriceFactor : hasValidFeeBps);

  // HANDLERS
  const handleTextChange = (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value);
    setError(null);
  };
  const handlePoolChange = handleTextChange(setPool);
  const handlePriceFactorChange = handleTextChange(setPriceFactor);
  const handleFeeBpsChange = handleTextChange(setFeeBps);

  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleModeChange = (selectedMode: WhirlpoolStateMode) => {
    setMode(selectedMode);
    setPool(selectedMode === WhirlpoolStateMode.PriceShock ? DEFAULT_WHIRLPOOL_POOL : '');
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);
    try {
      const result = isPriceShock
        ? await createWhirlpoolPriceShockScenario(studioUrl, rpcUrl, pool, priceFactor)
        : await createWhirlpoolFeeRateScenario(studioUrl, pool, feeBps);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create Whirlpool state scenario');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create Whirlpool state scenario</DialogTitle>
        <DialogDescription>
          Prepare Whirlpool pool state for bots to trade, arbitrage, or route around. Surfpool does not execute their
          transactions.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">State goal</span>
            <Listbox aria-label="State goal" value={mode} onChange={handleModeChange} disabled={isCreating}>
              {Object.values(WhirlpoolStateMode).map(renderStateModeOption)}
            </Listbox>
          </div>
          <Field
            id="whirlpool-pool"
            label="Whirlpool pool"
            placeholder="Pool address"
            value={pool}
            onChange={handlePoolChange}
            disabled={isCreating}
          />
          {isPriceShock ? (
            <Field
              id="whirlpool-price-factor"
              label="Price factor"
              placeholder="0.5 halves the price, 4 quadruples it"
              value={priceFactor}
              onChange={handlePriceFactorChange}
              disabled={isCreating}
            />
          ) : (
            <Field
              id="whirlpool-fee-bps"
              label="New fee (bps)"
              ariaLabel="New fee in basis points"
              placeholder="25 = 0.25%, must be under 600"
              value={feeBps}
              onChange={handleFeeBpsChange}
              disabled={isCreating}
            />
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
