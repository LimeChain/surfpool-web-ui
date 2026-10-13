'use client';

import { createPancakeswapClmmFeeTierScenario, createPancakeswapPriceShockScenario } from '@/lib/scenarios-api';
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

const MODE_OPTIONS = [
  { value: 'price-shock', label: 'CLMM price shock' },
  { value: 'fee-tier', label: 'CLMM fee tier' },
] as const;

type PancakeswapStateMode = (typeof MODE_OPTIONS)[number]['value'];

const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-zinc-300';

interface PancakeswapStateDialogProps {
  open: boolean;
  studioUrl: string;
  rpcUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

type FieldProps = Omit<ComponentProps<typeof Input>, 'onChange'> & {
  id: string;
  label: string;
  onChange: (value: string) => void;
};

function Field({ label, onChange, ...inputProps }: FieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);

  return (
    <div>
      <label htmlFor={inputProps.id} className={LABEL_CLASS}>
        {label}
      </label>
      <Input {...inputProps} onChange={handleChange} />
    </div>
  );
}

const renderOption = (option: { value: string; label: string }) => (
  <ListboxOption key={option.value} value={option.value}>
    {option.label}
  </ListboxOption>
);

export default function PancakeswapStateDialog({
  open,
  studioUrl,
  rpcUrl,
  onClose,
  onCreated,
}: PancakeswapStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<PancakeswapStateMode>('price-shock');
  const [pool, setPool] = useState('');
  const [priceFactor, setPriceFactor] = useState('');
  const [feeBps, setFeeBps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // DERIVED STATE
  const priceFactorNumber = Number(priceFactor.trim());
  const hasValidPriceFactor = Number.isFinite(priceFactorNumber) && priceFactorNumber > 0 && priceFactorNumber !== 1;
  const hasValidFeeBps = /^\d+$/.test(feeBps.trim()) && Number(feeBps.trim()) < 10000;
  const canCreate =
    !isCreating &&
    !!pool.trim() &&
    ((mode === 'price-shock' && hasValidPriceFactor) || (mode === 'fee-tier' && hasValidFeeBps));

  // HELPERS
  const resettingError =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setError(null);
    };

  // HANDLERS
  const handleModeChange = resettingError(setMode);
  const handlePoolChange = resettingError(setPool);
  const handlePriceFactorChange = resettingError(setPriceFactor);
  const handleFeeBpsChange = resettingError(setFeeBps);

  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const result =
        mode === 'price-shock'
          ? await createPancakeswapPriceShockScenario(studioUrl, rpcUrl, pool, priceFactor)
          : await createPancakeswapClmmFeeTierScenario(studioUrl, rpcUrl, pool, feeBps);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create PancakeSwap state scenario');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create PancakeSwap state scenario</DialogTitle>
        <DialogDescription>
          Prepare PancakeSwap CLMM pool state for bots to trade, arbitrage, or liquidate. Surfpool does not execute
          their transactions.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className={LABEL_CLASS}>State goal</span>
            <Listbox aria-label="State goal" value={mode} onChange={handleModeChange} disabled={isCreating}>
              {MODE_OPTIONS.map(renderOption)}
            </Listbox>
          </div>

          <Field
            id="pancakeswap-clmm-pool"
            label="CLMM pool"
            aria-label="PancakeSwap CLMM pool"
            placeholder="Address of the PancakeSwap CLMM pool"
            value={pool}
            onChange={handlePoolChange}
            disabled={isCreating}
          />
          {mode === 'price-shock' ? (
            <Field
              id="pancakeswap-price-factor"
              label="Price factor"
              aria-label="Price factor"
              placeholder="0.5 halves the price, 4 quadruples it"
              value={priceFactor}
              onChange={handlePriceFactorChange}
              disabled={isCreating}
            />
          ) : (
            <Field
              id="pancakeswap-fee-bps"
              label="New fee (bps)"
              aria-label="New fee in basis points"
              placeholder="25 = 0.25%"
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
