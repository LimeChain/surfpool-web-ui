'use client';

import {
  createRaydiumAmmPoolStatusScenario,
  createRaydiumClmmFeeTierScenario,
  createRaydiumClmmPriceShockScenario,
  fetchRaydiumFeeTierOptions,
  type RaydiumFeeTierOption,
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
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';

const RaydiumStateMode = {
  ClmmPriceShock: 'clmm-price-shock',
  AmmPoolStatus: 'amm-pool-status',
  ClmmFeeTier: 'clmm-fee-tier',
} as const;

type RaydiumStateMode = (typeof RaydiumStateMode)[keyof typeof RaydiumStateMode];

const RaydiumStateModeLabel: Record<RaydiumStateMode, string> = {
  [RaydiumStateMode.ClmmPriceShock]: 'CLMM price shock',
  [RaydiumStateMode.AmmPoolStatus]: 'AMM v4 pool status',
  [RaydiumStateMode.ClmmFeeTier]: 'CLMM fee tier',
};

const raydiumStateModes = Object.values(RaydiumStateMode);

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

interface RaydiumStateDialogProps {
  open: boolean;
  studioUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderStateModeOption = (stateMode: RaydiumStateMode) => (
  <ListboxOption key={stateMode} value={stateMode}>
    {RaydiumStateModeLabel[stateMode]}
  </ListboxOption>
);

const renderStatusOption = (option: (typeof AMM_POOL_STATUS_OPTIONS)[number]) => (
  <ListboxOption key={option.value} value={option.value}>
    {option.label}
  </ListboxOption>
);

const renderFeeTierOption = (option: RaydiumFeeTierOption) => (
  <ListboxOption key={option.value} value={option.value}>
    {option.label}
  </ListboxOption>
);

export default function RaydiumStateDialog({ open, studioUrl, onClose, onCreated }: RaydiumStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<RaydiumStateMode>(RaydiumStateMode.ClmmPriceShock);
  const [pool, setPool] = useState(DEFAULT_CLMM_POOL);
  const [priceFactor, setPriceFactor] = useState('0.5');
  const [status, setStatus] = useState('2');
  const [feeTierOptions, setFeeTierOptions] = useState<RaydiumFeeTierOption[]>([]);
  const [isLoadingFeeTiers, setIsLoadingFeeTiers] = useState(true);
  const [configIndex, setConfigIndex] = useState('');
  const [feeBps, setFeeBps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // DERIVED STATE
  const priceFactorNumber = Number(priceFactor.trim());
  const hasValidPriceFactor = Number.isFinite(priceFactorNumber) && priceFactorNumber > 0 && priceFactorNumber !== 1;
  const hasFeeTierCatalog = feeTierOptions.length > 0;
  const hasConfigIndex = !isLoadingFeeTiers && feeTierOptions.some((option) => option.value === configIndex);
  const hasValidFeeBps = /^\d+$/.test(feeBps.trim()) && Number(feeBps.trim()) < 10000;
  const canCreate =
    !isCreating &&
    ((mode === RaydiumStateMode.ClmmPriceShock && !!pool.trim() && hasValidPriceFactor) ||
      (mode === RaydiumStateMode.AmmPoolStatus && !!pool.trim() && !!status) ||
      (mode === RaydiumStateMode.ClmmFeeTier && hasConfigIndex && hasValidFeeBps));

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleModeChange = (selectedMode: RaydiumStateMode) => {
    setMode(selectedMode);
    setPool(selectedMode === RaydiumStateMode.ClmmPriceShock ? DEFAULT_CLMM_POOL : '');
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

  const handleStatusChange = (selectedStatus: string) => {
    setStatus(selectedStatus);
    setError(null);
  };

  const handleConfigIndexChange = (selectedConfigIndex: string) => {
    setConfigIndex(selectedConfigIndex);
    setError(null);
  };

  const handleFeeBpsChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFeeBps(event.target.value);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const result =
        mode === RaydiumStateMode.ClmmPriceShock
          ? await createRaydiumClmmPriceShockScenario(studioUrl, pool, priceFactor)
          : mode === RaydiumStateMode.AmmPoolStatus
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
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">State goal</span>
            <Listbox aria-label="State goal" value={mode} onChange={handleModeChange} disabled={isCreating}>
              {raydiumStateModes.map(renderStateModeOption)}
            </Listbox>
          </div>

          {mode === RaydiumStateMode.ClmmPriceShock ? (
            <>
              <div>
                <label htmlFor="raydium-clmm-pool" className="mb-1.5 block text-sm font-medium text-zinc-300">
                  CLMM pool
                </label>
                <Input
                  id="raydium-clmm-pool"
                  aria-label="Raydium CLMM pool"
                  placeholder="Pool address"
                  value={pool}
                  onChange={handlePoolChange}
                  disabled={isCreating}
                />
              </div>
              <div>
                <label htmlFor="raydium-price-factor" className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Price factor
                </label>
                <Input
                  id="raydium-price-factor"
                  aria-label="Price factor"
                  placeholder="0.5 halves the price, 4 quadruples it"
                  value={priceFactor}
                  onChange={handlePriceFactorChange}
                  disabled={isCreating}
                />
              </div>
            </>
          ) : mode === RaydiumStateMode.AmmPoolStatus ? (
            <>
              <div>
                <label htmlFor="raydium-amm-pool" className="mb-1.5 block text-sm font-medium text-zinc-300">
                  AMM v4 pool
                </label>
                <Input
                  id="raydium-amm-pool"
                  aria-label="Raydium AMM v4 pool"
                  placeholder="Pool address"
                  value={pool}
                  onChange={handlePoolChange}
                  disabled={isCreating}
                />
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-zinc-300">Pool status</span>
                <Listbox aria-label="Pool status" value={status} onChange={handleStatusChange} disabled={isCreating}>
                  {AMM_POOL_STATUS_OPTIONS.map(renderStatusOption)}
                </Listbox>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-zinc-300">Fee tier</span>
                <Listbox
                  aria-label="Fee tier"
                  value={configIndex}
                  onChange={handleConfigIndexChange}
                  disabled={isCreating || isLoadingFeeTiers || !hasFeeTierCatalog}
                  placeholder={isLoadingFeeTiers ? 'Loading fee tiers…' : 'No fee tiers available'}
                >
                  {feeTierOptions.map(renderFeeTierOption)}
                </Listbox>
                {!isLoadingFeeTiers && !hasFeeTierCatalog && (
                  <p role="status" className="mt-1.5 text-sm text-zinc-400">
                    No fee tiers available. Check the Studio connection and reopen this dialog.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="raydium-fee-bps" className="mb-1.5 block text-sm font-medium text-zinc-300">
                  New fee (bps)
                </label>
                <Input
                  id="raydium-fee-bps"
                  aria-label="New fee in basis points"
                  placeholder="25 = 0.25%"
                  value={feeBps}
                  onChange={handleFeeBpsChange}
                  disabled={isCreating}
                />
              </div>
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
