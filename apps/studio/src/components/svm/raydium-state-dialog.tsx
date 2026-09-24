'use client';

import {
  createRaydiumAmmPoolStatusScenario,
  createRaydiumClmmFeeTierScenario,
  createRaydiumClmmPriceShockScenario,
  fetchRaydiumFeeTierOptions,
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
import { type ChangeEvent, type ComponentProps, type FormEvent, useEffect, useId, useState } from 'react';

const STATE_MODES = [
  { value: 'clmm-price-shock', label: 'CLMM price shock' },
  { value: 'amm-pool-status', label: 'AMM v4 pool status' },
  { value: 'clmm-fee-tier', label: 'CLMM fee tier' },
] as const;

type RaydiumStateMode = (typeof STATE_MODES)[number]['value'];

// A well-known CLMM pool, so the price-shock mode opens with a valid address already filled.
const DEFAULT_CLMM_POOL = '3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv';

// AmmStatus values from raydium-io/raydium-amm's state.rs; swaps run only at 1, 6 and 7.
const AMM_POOL_STATUS_OPTIONS = [
  { value: '0', label: '0 — Uninitialized' },
  { value: '1', label: '1 — Initialized' },
  { value: '2', label: '2 — Disabled' },
  { value: '3', label: '3 — Withdraw only' },
  { value: '4', label: '4 — Liquidity only' },
  { value: '5', label: '5 — Orderbook only' },
  { value: '6', label: '6 — Swap only' },
  { value: '7', label: '7 — Waiting trade' },
];

const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-zinc-300';

type ListOption = { value: string; label: string };

interface RaydiumStateDialogProps {
  open: boolean;
  studioUrl: string;
  rpcUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderOption = (option: ListOption) => (
  <ListboxOption key={option.value} value={option.value}>
    {option.label}
  </ListboxOption>
);

function Field({ label, ...inputProps }: { label: string } & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <Input id={id} {...inputProps} />
    </div>
  );
}

export default function RaydiumStateDialog({ open, studioUrl, rpcUrl, onClose, onCreated }: RaydiumStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<RaydiumStateMode>('clmm-price-shock');
  const [pool, setPool] = useState(DEFAULT_CLMM_POOL);
  const [priceFactor, setPriceFactor] = useState('0.5');
  const [status, setStatus] = useState('2');
  const [feeTierOptions, setFeeTierOptions] = useState<ListOption[]>([]);
  const [isLoadingFeeTiers, setIsLoadingFeeTiers] = useState(true);
  const [configIndex, setConfigIndex] = useState('');
  const [feeBps, setFeeBps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // DERIVED STATE
  const isPriceShock = mode === 'clmm-price-shock';
  const isFeeTier = mode === 'clmm-fee-tier';
  const priceFactorNumber = Number(priceFactor.trim());
  const hasValidPriceFactor = Number.isFinite(priceFactorNumber) && priceFactorNumber > 0 && priceFactorNumber !== 1;
  const hasFeeTierCatalog = feeTierOptions.length > 0;
  const hasConfigIndex = !isLoadingFeeTiers && feeTierOptions.some((option) => option.value === configIndex);
  const hasValidFeeBps = /^\d+$/.test(feeBps.trim()) && Number(feeBps.trim()) < 10000;
  const canCreate =
    !isCreating &&
    ((isPriceShock && !!pool.trim() && hasValidPriceFactor) ||
      (mode === 'amm-pool-status' && !!pool.trim() && !!status) ||
      (isFeeTier && hasConfigIndex && hasValidFeeBps));

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleModeChange = (selectedMode: RaydiumStateMode) => {
    setMode(selectedMode);
    setPool(selectedMode === 'clmm-price-shock' ? DEFAULT_CLMM_POOL : '');
    setError(null);
  };

  const handleChange = (setter: (value: string) => void) => (input: string | ChangeEvent<HTMLInputElement>) => {
    setter(typeof input === 'string' ? input : input.target.value);
    setError(null);
  };

  const handlePoolChange = handleChange(setPool);
  const handlePriceFactorChange = handleChange(setPriceFactor);
  const handleStatusChange = handleChange(setStatus);
  const handleConfigIndexChange = handleChange(setConfigIndex);
  const handleFeeBpsChange = handleChange(setFeeBps);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = isPriceShock
        ? await createRaydiumClmmPriceShockScenario(studioUrl, rpcUrl, pool, priceFactor)
        : mode === 'amm-pool-status'
          ? await createRaydiumAmmPoolStatusScenario(studioUrl, pool, status)
          : await createRaydiumClmmFeeTierScenario(studioUrl, configIndex, feeBps);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create Raydium state scenario');
    } finally {
      setIsCreating(false);
    }
  };

  // EFFECTS
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setIsLoadingFeeTiers(true);
    setFeeTierOptions([]);

    fetchRaydiumFeeTierOptions(studioUrl).then((options) => {
      if (cancelled) return;
      setFeeTierOptions(options);
      setConfigIndex((current) =>
        options.some((option) => option.value === current) ? current : (options[0]?.value ?? '')
      );
      setIsLoadingFeeTiers(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, studioUrl]);

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create Raydium state scenario</DialogTitle>
        <DialogDescription>
          Prepare Raydium pool state for bots to trade, arbitrage, or liquidate. Surfpool does not execute their
          transactions.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className={LABEL_CLASS}>State goal</span>
            <Listbox aria-label="State goal" value={mode} onChange={handleModeChange} disabled={isCreating}>
              {STATE_MODES.map(renderOption)}
            </Listbox>
          </div>

          {!isFeeTier && (
            <Field
              label={isPriceShock ? 'CLMM pool' : 'AMM v4 pool'}
              aria-label={isPriceShock ? 'Raydium CLMM pool' : 'Raydium AMM v4 pool'}
              placeholder="Pool address"
              value={pool}
              onChange={handlePoolChange}
              disabled={isCreating}
            />
          )}
          {isPriceShock && (
            <Field
              label="Price factor"
              placeholder="0.5 halves the price, 4 quadruples it"
              value={priceFactor}
              onChange={handlePriceFactorChange}
              disabled={isCreating}
            />
          )}
          {mode === 'amm-pool-status' && (
            <div>
              <span className={LABEL_CLASS}>Pool status</span>
              <Listbox aria-label="Pool status" value={status} onChange={handleStatusChange} disabled={isCreating}>
                {AMM_POOL_STATUS_OPTIONS.map(renderOption)}
              </Listbox>
            </div>
          )}
          {isFeeTier && (
            <>
              <div>
                <span className={LABEL_CLASS}>Fee tier</span>
                <Listbox
                  aria-label="Fee tier"
                  value={configIndex}
                  onChange={handleConfigIndexChange}
                  disabled={isCreating || isLoadingFeeTiers || !hasFeeTierCatalog}
                  placeholder={isLoadingFeeTiers ? 'Loading fee tiers…' : 'No fee tiers available'}
                >
                  {feeTierOptions.map(renderOption)}
                </Listbox>
                {!isLoadingFeeTiers && !hasFeeTierCatalog && (
                  <p role="status" className="mt-1.5 text-sm text-zinc-400">
                    No fee tiers available. Check the Studio connection and reopen this dialog.
                  </p>
                )}
              </div>
              <Field
                label="New fee (bps)"
                aria-label="New fee in basis points"
                placeholder="25 = 0.25%"
                value={feeBps}
                onChange={handleFeeBpsChange}
                disabled={isCreating}
              />
            </>
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
