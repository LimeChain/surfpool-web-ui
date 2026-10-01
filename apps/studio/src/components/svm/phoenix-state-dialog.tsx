'use client';

import {
  createPhoenixCollateralScenario,
  createPhoenixDirectMarkScenario,
  createPhoenixMaintenanceMarginScenario,
  fetchDynamicRefOptions,
  type DynamicRefOption,
} from '@/lib/scenarios-api';
import {
  Button,
  Combobox,
  ComboboxDescription,
  ComboboxLabel,
  ComboboxOption,
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
  Input,
  Listbox,
  ListboxOption,
} from '@surfpool/ui';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { findOptionByTypedValue } from './token-selector-options';

const PhoenixStateMode = {
  Collateral: 'collateral',
  DirectMark: 'direct-mark',
  MaintenanceMargin: 'maintenance-margin',
} as const;

type PhoenixStateMode = (typeof PhoenixStateMode)[keyof typeof PhoenixStateMode];

const PhoenixStateModeLabel: Record<PhoenixStateMode, string> = {
  [PhoenixStateMode.Collateral]: 'Liquidation-risk collateral',
  [PhoenixStateMode.DirectMark]: 'Direct mark-price adjustment',
  [PhoenixStateMode.MaintenanceMargin]: 'Maintenance margin stress',
};

const phoenixStateModes = Object.values(PhoenixStateMode);

interface PhoenixStateDialogProps {
  open: boolean;
  studioUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderStateModeOption = (stateMode: PhoenixStateMode) => (
  <ListboxOption key={stateMode} value={stateMode}>
    {PhoenixStateModeLabel[stateMode]}
  </ListboxOption>
);

const displayMarketSymbol = (marketSymbol: string | null) => marketSymbol ?? undefined;

export default function PhoenixStateDialog({ open, studioUrl, onClose, onCreated }: PhoenixStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<PhoenixStateMode>(PhoenixStateMode.DirectMark);
  const [trader, setTrader] = useState('');
  const [symbol, setSymbol] = useState('BTC');
  const [targetQuoteLots, setTargetQuoteLots] = useState('');
  const [targetTicks, setTargetTicks] = useState('');
  const [riskFactor, setRiskFactor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [marketOptions, setMarketOptions] = useState<DynamicRefOption[]>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);

  // DERIVED STATE
  const hasSignedCollateral = /^-?\d+$/.test(targetQuoteLots.trim());
  const hasTargetTicks = /^\d+$/.test(targetTicks.trim());
  const hasRiskFactor = /^\d+$/.test(riskFactor.trim()) && Number(riskFactor) >= 1 && Number(riskFactor) <= 65535;
  const symbolOptions = marketOptions.map((option) => option.value);
  const addressBySymbol = new Map(marketOptions.map((option) => [option.value, option.address]));
  const hasSymbolCatalog = marketOptions.length > 0;
  const isCatalogUnavailable = !isLoadingSymbols && !hasSymbolCatalog;
  const marketSymbol = isLoadingSymbols ? '' : symbol.trim();
  const hasSymbol = !!marketSymbol;
  const isCustomSymbol = hasSymbol && !symbolOptions.includes(marketSymbol);
  const canCreate =
    !isCreating &&
    ((mode === PhoenixStateMode.Collateral && !!trader.trim() && hasSignedCollateral) ||
      (mode === PhoenixStateMode.DirectMark && hasSymbol && hasTargetTicks) ||
      (mode === PhoenixStateMode.MaintenanceMargin && hasSymbol && hasRiskFactor));

  // HELPERS
  const matchesMarket = (optionSymbol: string | null, query: string) => {
    if (!optionSymbol) return false;
    const search = query.trim().toLowerCase();
    const address = addressBySymbol.get(optionSymbol)?.toLowerCase();
    return optionSymbol.toLowerCase().includes(search) || !!address?.includes(search);
  };

  const customMarketSymbol = (query: string) =>
    findOptionByTypedValue(
      marketOptions.map((option) => ({ id: option.value, label: option.value, ...option })),
      query
    )
      ? null
      : query;

  const renderMarketOption = (optionSymbol: string) => (
    <ComboboxOption key={optionSymbol} value={optionSymbol}>
      <ComboboxLabel>{optionSymbol}</ComboboxLabel>
      <ComboboxDescription>{addressBySymbol.get(optionSymbol) ?? 'Custom symbol'}</ComboboxDescription>
    </ComboboxOption>
  );

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

  const handleSymbolChange = (pickedSymbol: string | null) => {
    if (!pickedSymbol) return;
    setSymbol(pickedSymbol);
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

  const handleRiskFactorChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRiskFactor(event.target.value);
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
            ? await createPhoenixDirectMarkScenario(studioUrl, marketSymbol, targetTicks)
            : await createPhoenixMaintenanceMarginScenario(studioUrl, marketSymbol, riskFactor);
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

    setIsLoadingSymbols(true);
    setMarketOptions([]);

    const handleSymbolsLoaded = (options: DynamicRefOption[]) => {
      if (cancelled) return;
      setMarketOptions(options);
      setSymbol((current) =>
        options.some((option) => option.value === current) ? current : (options[0]?.value ?? '')
      );
      setIsLoadingSymbols(false);
    };

    fetchDynamicRefOptions(studioUrl, 'list_phoenix_markets').then(handleSymbolsLoaded);

    return () => {
      cancelled = true;
    };
  }, [open, studioUrl]);

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create Phoenix state scenario</DialogTitle>
        <DialogDescription>
          Prepare Phoenix state for bots to trade, arbitrage, or liquidate. Surfpool does not execute their
          transactions.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">State goal</span>
            <Listbox aria-label="State goal" value={mode} onChange={handleModeChange} disabled={isCreating}>
              {phoenixStateModes.map(renderStateModeOption)}
            </Listbox>
          </div>

          {mode === PhoenixStateMode.Collateral ? (
            <>
              <Input
                aria-label="Phoenix Trader account"
                placeholder="Trader account"
                value={trader}
                onChange={handleTraderChange}
              />
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
                {/* null, not undefined: Headless UI treats undefined as uncontrolled and warns once markets load. */}
                <Combobox<string | null>
                  aria-label="Phoenix market"
                  placeholder={isLoadingSymbols ? 'Loading markets…' : 'Search or type a symbol or orderbook address'}
                  options={symbolOptions}
                  value={symbol || null}
                  immediate
                  displayValue={displayMarketSymbol}
                  filter={matchesMarket}
                  customOption={customMarketSymbol}
                  onChange={handleSymbolChange}
                  disabled={isCreating || isLoadingSymbols}
                >
                  {renderMarketOption}
                </Combobox>
                {(isCatalogUnavailable || isCustomSymbol) && (
                  <p role="status" className="mt-1.5 text-sm text-zinc-400">
                    {isCatalogUnavailable && 'Markets could not be loaded, so type the exact symbol. '}A symbol Phoenix
                    does not list is skipped at Play.
                  </p>
                )}
              </div>
              {mode === PhoenixStateMode.DirectMark ? (
                <Input
                  aria-label="Target mark ticks"
                  placeholder="Target mark ticks"
                  value={targetTicks}
                  onChange={handleTargetTicksChange}
                />
              ) : (
                <Input
                  aria-label="Maintenance risk factor"
                  placeholder="Maintenance risk factor in bps (live markets use 5000)"
                  value={riskFactor}
                  onChange={handleRiskFactorChange}
                />
              )}
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
