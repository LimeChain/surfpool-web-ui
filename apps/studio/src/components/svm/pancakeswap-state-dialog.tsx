'use client';

import {
  createPancakeswapClmmFeeTierScenario,
  createPancakeswapPriceShockScenario,
  fetchPancakeswapFeeTierOptions,
  type PancakeswapFeeTierOption,
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

const PancakeswapStateMode = {
  PriceShock: 'price-shock',
  FeeTier: 'fee-tier',
} as const;

type PancakeswapStateMode = (typeof PancakeswapStateMode)[keyof typeof PancakeswapStateMode];

const PancakeswapStateModeLabel: Record<PancakeswapStateMode, string> = {
  [PancakeswapStateMode.PriceShock]: 'CLMM price shock',
  [PancakeswapStateMode.FeeTier]: 'CLMM fee tier',
};

const pancakeswapStateModes = Object.values(PancakeswapStateMode);

// The SOL-paired CLMM pool, so the price-shock mode opens with a valid address already filled.
const DEFAULT_CLMM_POOL = 'DJNtGuBGEQiUCWE8F981M2C3ZghZt2XLD8f2sQdZ6rsZ';

interface PancakeswapStateDialogProps {
  open: boolean;
  studioUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderStateModeOption = (stateMode: PancakeswapStateMode) => (
  <ListboxOption key={stateMode} value={stateMode}>
    {PancakeswapStateModeLabel[stateMode]}
  </ListboxOption>
);

const renderFeeTierOption = (option: PancakeswapFeeTierOption) => (
  <ListboxOption key={option.value} value={option.value}>
    {option.label}
  </ListboxOption>
);

export default function PancakeswapStateDialog({ open, studioUrl, onClose, onCreated }: PancakeswapStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<PancakeswapStateMode>(PancakeswapStateMode.PriceShock);
  const [pool, setPool] = useState(DEFAULT_CLMM_POOL);
  const [priceFactor, setPriceFactor] = useState('0.5');
  const [feeTierOptions, setFeeTierOptions] = useState<PancakeswapFeeTierOption[]>([]);
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
    ((mode === PancakeswapStateMode.PriceShock && !!pool.trim() && hasValidPriceFactor) ||
      (mode === PancakeswapStateMode.FeeTier && hasConfigIndex && hasValidFeeBps));

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleModeChange = (selectedMode: PancakeswapStateMode) => {
    setMode(selectedMode);
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
        mode === PancakeswapStateMode.PriceShock
          ? await createPancakeswapPriceShockScenario(studioUrl, pool, priceFactor)
          : await createPancakeswapClmmFeeTierScenario(studioUrl, configIndex, feeBps);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create PancakeSwap state scenario');
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

    fetchPancakeswapFeeTierOptions(studioUrl).then((options) => {
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
        <DialogTitle>Create PancakeSwap state scenario</DialogTitle>
        <DialogDescription>
          Prepare PancakeSwap CLMM pool state for bots to trade, arbitrage, or liquidate. Surfpool does not execute
          their transactions.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">State goal</span>
            <Listbox aria-label="State goal" value={mode} onChange={handleModeChange} disabled={isCreating}>
              {pancakeswapStateModes.map(renderStateModeOption)}
            </Listbox>
          </div>

          {mode === PancakeswapStateMode.PriceShock ? (
            <>
              <div>
                <label htmlFor="pancakeswap-clmm-pool" className="mb-1.5 block text-sm font-medium text-zinc-300">
                  CLMM pool
                </label>
                <Input
                  id="pancakeswap-clmm-pool"
                  aria-label="PancakeSwap CLMM pool"
                  placeholder="Pool address"
                  value={pool}
                  onChange={handlePoolChange}
                  disabled={isCreating}
                />
              </div>
              <div>
                <label htmlFor="pancakeswap-price-factor" className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Price factor
                </label>
                <Input
                  id="pancakeswap-price-factor"
                  aria-label="Price factor"
                  placeholder="0.5 halves the price, 4 quadruples it"
                  value={priceFactor}
                  onChange={handlePriceFactorChange}
                  disabled={isCreating}
                />
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
                <label htmlFor="pancakeswap-fee-bps" className="mb-1.5 block text-sm font-medium text-zinc-300">
                  New fee (bps)
                </label>
                <Input
                  id="pancakeswap-fee-bps"
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
