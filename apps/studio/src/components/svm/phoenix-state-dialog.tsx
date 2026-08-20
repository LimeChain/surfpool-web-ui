'use client';

import {
  createPhoenixCollateralScenario,
  createPhoenixDirectMarkScenario,
  createPhoenixReferencePriceScenario,
  fetchPhoenixMarketSymbols,
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

const PhoenixStateMode = {
  Collateral: 'collateral',
  DirectMark: 'direct-mark',
  ReferencePrices: 'reference-prices',
} as const;

type PhoenixStateMode = (typeof PhoenixStateMode)[keyof typeof PhoenixStateMode];

const PhoenixStateModeLabel: Record<PhoenixStateMode, string> = {
  [PhoenixStateMode.Collateral]: 'Liquidation-risk collateral',
  [PhoenixStateMode.DirectMark]: 'Direct mark-price adjustment',
  [PhoenixStateMode.ReferencePrices]: 'Spot/perp reference divergence',
};

const phoenixStateModes = Object.values(PhoenixStateMode);

interface PhoenixStateDialogProps {
  open: boolean;
  studioUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderMarketOption = (marketSymbol: string) => (
  <ListboxOption key={marketSymbol} value={marketSymbol}>
    {marketSymbol}
  </ListboxOption>
);

const renderStateModeOption = (stateMode: PhoenixStateMode) => (
  <ListboxOption key={stateMode} value={stateMode}>
    {PhoenixStateModeLabel[stateMode]}
  </ListboxOption>
);

export default function PhoenixStateDialog({ open, studioUrl, onClose, onCreated }: PhoenixStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<PhoenixStateMode>(PhoenixStateMode.ReferencePrices);
  const [trader, setTrader] = useState('');
  const [symbol, setSymbol] = useState('BTC');
  const [targetQuoteLots, setTargetQuoteLots] = useState('');
  const [targetTicks, setTargetTicks] = useState('');
  const [spotTicks, setSpotTicks] = useState('');
  const [perpTicks, setPerpTicks] = useState('');
  const [marketSymbols, setMarketSymbols] = useState<string[]>([]);
  const [marketLoadError, setMarketLoadError] = useState<string | null>(null);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // DERIVED STATE
  const hasSignedCollateral = /^-?\d+$/.test(targetQuoteLots.trim());
  const hasTargetTicks = /^\d+$/.test(targetTicks.trim());
  const hasSpotTicks = /^\d+$/.test(spotTicks.trim());
  const hasPerpTicks = /^\d+$/.test(perpTicks.trim());
  const hasSymbol = !!symbol.trim();
  const canCreate =
    !isCreating &&
    ((mode === PhoenixStateMode.Collateral && !!trader.trim() && hasSignedCollateral) ||
      (!isLoadingMarkets &&
        !marketLoadError &&
        ((mode === PhoenixStateMode.DirectMark && hasSymbol && hasTargetTicks) ||
          (mode === PhoenixStateMode.ReferencePrices && hasSymbol && hasSpotTicks && hasPerpTicks))));
  const visibleError = error ?? (mode === PhoenixStateMode.Collateral ? null : marketLoadError);

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleModeChange = (selectedMode: PhoenixStateMode) => {
    setMode(selectedMode);
    setError(null);
  };

  const handleTraderChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTrader(event.target.value);
    setError(null);
  };

  const handleSymbolChange = (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    setError(null);
  };

  const handleTargetQuoteLotsChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTargetQuoteLots(event.target.value);
    setError(null);
  };

  const handleTargetTicksChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTargetTicks(event.target.value);
    setError(null);
  };

  const handleSpotTicksChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSpotTicks(event.target.value);
    setError(null);
  };

  const handlePerpTicksChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPerpTicks(event.target.value);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const result =
        mode === PhoenixStateMode.Collateral
          ? await createPhoenixCollateralScenario(studioUrl, trader, targetQuoteLots)
          : mode === PhoenixStateMode.DirectMark
            ? await createPhoenixDirectMarkScenario(studioUrl, symbol, targetTicks)
            : await createPhoenixReferencePriceScenario(studioUrl, symbol, spotTicks, perpTicks);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create Phoenix state scenario');
    } finally {
      setIsCreating(false);
    }
  };

  // EFFECTS
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadMarketSymbols = async () => {
      setIsLoadingMarkets(true);
      setMarketLoadError(null);

      try {
        const symbols = await fetchPhoenixMarketSymbols(studioUrl);
        if (cancelled) return;

        setMarketSymbols(symbols);
        setSymbol(symbols.includes('BTC') ? 'BTC' : (symbols[0] ?? ''));
        if (symbols.length === 0) {
          setMarketLoadError('No active Phoenix markets are available');
        }
      } catch (requestError) {
        if (cancelled) return;

        setMarketSymbols([]);
        setSymbol('');
        setMarketLoadError(
          requestError instanceof Error ? requestError.message : 'Failed to load Phoenix markets'
        );
      } finally {
        if (!cancelled) setIsLoadingMarkets(false);
      }
    };

    void loadMarketSymbols();

    return () => {
      cancelled = true;
    };
  }, [open, studioUrl]);

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create Phoenix state scenario</DialogTitle>
        <DialogDescription>
          Prepare Phoenix state for bots to trade, arbitrage, or liquidate. Surfpool does not execute their transactions.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">
              State goal
            </span>
            <Listbox
              aria-label="State goal"
              value={mode}
              onChange={handleModeChange}
              disabled={isCreating}
            >
              {phoenixStateModes.map(renderStateModeOption)}
            </Listbox>
          </div>

          {mode === PhoenixStateMode.Collateral ? (
            <>
              <Input aria-label="Phoenix Trader account" placeholder="Trader account" value={trader} onChange={handleTraderChange} />
              <Input
                aria-label="Target collateral quote lots"
                placeholder="Target signed quote lots"
                value={targetQuoteLots}
                onChange={handleTargetQuoteLotsChange}
              />
            </>
          ) : (
            <>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-zinc-300">Market</span>
                <Listbox
                  aria-label="Phoenix market"
                  value={symbol || undefined}
                  onChange={handleSymbolChange}
                  placeholder={isLoadingMarkets ? 'Loading markets…' : 'Select market…'}
                  disabled={isCreating || isLoadingMarkets || !!marketLoadError}
                >
                  {marketSymbols.map(renderMarketOption)}
                </Listbox>
              </div>
              {mode === PhoenixStateMode.DirectMark ? (
                <Input
                  aria-label="Target mark ticks"
                  placeholder="Target mark ticks"
                  value={targetTicks}
                  onChange={handleTargetTicksChange}
                />
              ) : (
                <>
                  <Input
                    aria-label="Spot reference ticks"
                    placeholder="Spot reference ticks"
                    value={spotTicks}
                    onChange={handleSpotTicksChange}
                  />
                  <Input
                    aria-label="Perp reference ticks"
                    placeholder="External-perp reference ticks"
                    value={perpTicks}
                    onChange={handlePerpTicksChange}
                  />
                </>
              )}
            </>
          )}
          {!!visibleError && <p className="text-sm text-red-400">{visibleError}</p>}
        </div>
        <DialogActions>
          <Button type="button" color="dark" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" color="pink" disabled={!canCreate}>
            {isCreating ? 'Validating…' : 'Create scenario'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
