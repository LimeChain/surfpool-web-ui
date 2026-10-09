'use client';

import {
  createPhoenixLiquidationCascadeScenario,
  createPhoenixLiquidationReadyScenario,
  createPhoenixMaintenanceMarginScenario,
  createPhoenixMarketMoveScenario,
  fetchDynamicRefOptions,
  fetchPhoenixTraderPositions,
  type DynamicRefOption,
  type PhoenixTraderPosition,
} from '@/lib/scenarios-api';
import { PublicKey } from '@solana/web3.js';
import {
  Badge,
  Button,
  Checkbox,
  CheckboxField,
  CheckboxGroup,
  Combobox,
  ComboboxDescription,
  ComboboxLabel,
  ComboboxOption,
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
  Listbox,
  ListboxOption,
  Switch,
} from '@surfpool/ui';
import clsx from 'clsx';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { findOptionByTypedValue } from './token-selector-options';

const PhoenixStateMode = {
  MarketMove: 'market-move',
  LiquidationReady: 'liquidation-ready',
  LiquidationCascade: 'liquidation-cascade',
  MaintenanceMargin: 'maintenance-margin',
} as const;

type PhoenixStateMode = (typeof PhoenixStateMode)[keyof typeof PhoenixStateMode];

const PhoenixStateModeLabel: Record<PhoenixStateMode, string> = {
  [PhoenixStateMode.MarketMove]: 'Market price move',
  [PhoenixStateMode.LiquidationReady]: 'Liquidate trader positions',
  [PhoenixStateMode.LiquidationCascade]: 'Liquidation cascade',
  [PhoenixStateMode.MaintenanceMargin]: 'Maintenance margin factor',
};

const phoenixStateModes = Object.values(PhoenixStateMode);

const CascadeSide = {
  Long: 'long',
  Short: 'short',
} as const;

type CascadeSide = (typeof CascadeSide)[keyof typeof CascadeSide];

const CascadeSideLabel: Record<CascadeSide, string> = {
  [CascadeSide.Long]: 'Longs, after a drop',
  [CascadeSide.Short]: 'Shorts, after a rise',
};

const cascadeSides = Object.values(CascadeSide);

// The backend's ranges: a price is a u32 tick count of at least 1, and a risk factor is at most
// 100% of the initial margin. Phoenix also refuses a maintenance factor above the market's cancel
// order factor, which only the backend can check.
const MAX_MARK_TICKS = 4_294_967_295;
const MAX_RISK_FACTOR_BPS = 10_000;

const isAddress = (value: string) => {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
};

const isWholeNumberInRange = (value: string, min: number, max: number) =>
  /^\d+$/.test(value.trim()) && Number(value) >= min && Number(value) <= max;

type PhoenixUnit = 'percent' | 'usd' | 'raw';

interface UnitChoice {
  unit: PhoenixUnit;
  label: string;
  placeholder: string;
}

// The liquidation goals pick their own price, so only these two take an amount.
const unitChoices: Record<PhoenixStateMode, UnitChoice[]> = {
  [PhoenixStateMode.MarketMove]: [
    { unit: 'percent', label: '%', placeholder: 'Change from the current mark, for example -10' },
    { unit: 'usd', label: 'USD', placeholder: 'Target price' },
    { unit: 'raw', label: 'Ticks', placeholder: 'Target ticks, at least 1' },
  ],
  [PhoenixStateMode.LiquidationReady]: [],
  [PhoenixStateMode.LiquidationCascade]: [],
  [PhoenixStateMode.MaintenanceMargin]: [
    { unit: 'percent', label: '%', placeholder: 'Share of initial margin, mainnet markets use 50' },
    { unit: 'raw', label: 'bps', placeholder: 'At most the cancel order factor, mainnet markets use 5000' },
  ],
};

const amountLabel: Partial<Record<PhoenixStateMode, string>> = {
  [PhoenixStateMode.MarketMove]: 'Target price',
  [PhoenixStateMode.MaintenanceMargin]: 'Maintenance risk factor',
};

const PhoenixStateModeHint: Record<PhoenixStateMode, string> = {
  [PhoenixStateMode.MarketMove]: 'Moves the oracle readings, maker liquidity and the order book to the new price.',
  [PhoenixStateMode.LiquidationReady]:
    'Cancels the resting orders of the trader and moves the chosen markets until a keeper can liquidate each chosen position in turn.',
  [PhoenixStateMode.LiquidationCascade]:
    'Moves the market to the price where the most holders are liquidatable and prepares every one of them.',
  [PhoenixStateMode.MaintenanceMargin]: 'Changes the share of initial margin a position must keep before liquidation.',
};

const formatPositionSize = (position: PhoenixTraderPosition, market?: DynamicRefOption) => {
  const lots = Math.abs(Number(position.baseLots));
  const decimals = market?.baseLotDecimals;
  return decimals === undefined
    ? `${position.baseLots} base lots`
    : `${(lots / 10 ** decimals).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${position.symbol}`;
};

const formatUsd = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}`;

const usdPerTick = (market?: DynamicRefOption) =>
  (market?.tickSize ?? NaN) * 10 ** ((market?.baseLotDecimals ?? NaN) - 6);

// Risk factors are bps of initial margin. Raw input passes through as typed, so large tick counts
// stay exact.
const toRawAmount = (mode: PhoenixStateMode, unit: PhoenixUnit, amount: string, market?: DynamicRefOption) => {
  if (unit === 'raw') return amount.trim();
  const value = amount.trim() ? Number(amount) : NaN;
  const raw =
    mode === PhoenixStateMode.MaintenanceMargin
      ? value * 100
      : unit === 'usd'
        ? value / usdPerTick(market)
        : (market?.markTicks ?? NaN) * (1 + value / 100);
  return Number.isSafeInteger(Math.round(raw)) ? String(Math.round(raw)) : null;
};

// The units a market can convert; one without price data takes raw ticks only.
const availableUnits = (mode: PhoenixStateMode, market?: DynamicRefOption) =>
  unitChoices[mode].filter((choice) => toRawAmount(mode, choice.unit, '0', market) !== null);

interface PhoenixStateDialogProps {
  open: boolean;
  studioUrl: string;
  rpcUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderStateModeOption = (stateMode: PhoenixStateMode) => (
  <ListboxOption key={stateMode} value={stateMode}>
    {PhoenixStateModeLabel[stateMode]}
  </ListboxOption>
);

const renderCascadeSideOption = (side: CascadeSide) => (
  <ListboxOption key={side} value={side}>
    {CascadeSideLabel[side]}
  </ListboxOption>
);

const renderUnitOption = ({ unit, label }: UnitChoice) => (
  <ListboxOption key={unit} value={unit}>
    {label}
  </ListboxOption>
);

const displayMarketSymbol = (marketSymbol: string | null) => marketSymbol ?? undefined;

interface PositionOptionProps {
  position: PhoenixTraderPosition;
  size: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (symbol: string, checked: boolean) => void;
}

function PositionOption({ position, size, checked, disabled, onToggle }: PositionOptionProps) {
  // DERIVED STATE
  const isLong = position.side === 'long';
  const maintenanceUsd = Number(position.maintenanceMarginQuoteLots) / 1e6;
  // Whole dollars, except below $1, where rounding would show $0.
  const margin = formatUsd(maintenanceUsd >= 1 ? Math.round(maintenanceUsd) : maintenanceUsd);

  // HANDLERS
  const handleChange = (isChecked: boolean) => onToggle(position.symbol, isChecked);

  return (
    <CheckboxField
      disabled={disabled}
      className={clsx('items-center px-3 py-2 transition-colors', checked ? 'bg-purple-500/10' : 'hover:bg-white/5')}
    >
      <Checkbox checked={checked} onChange={handleChange} color="purple" />
      <Label className="flex min-w-0 items-center gap-2">
        <span className="font-semibold text-zinc-100">{position.symbol}</span>
        <Badge color={isLong ? 'green' : 'red'}>{isLong ? 'Long' : 'Short'}</Badge>
        <span className="ml-auto truncate text-xs text-zinc-400">
          {size} · margin {margin}
        </span>
      </Label>
    </CheckboxField>
  );
}

export default function PhoenixStateDialog({ open, studioUrl, rpcUrl, onClose, onCreated }: PhoenixStateDialogProps) {
  // STATE
  const [mode, setMode] = useState<PhoenixStateMode>(PhoenixStateMode.MarketMove);
  const [trader, setTrader] = useState('');
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('');
  const [side, setSide] = useState<CascadeSide>(CascadeSide.Long);
  const [keepEarlierChanges, setKeepEarlierChanges] = useState(true);
  const [unit, setUnit] = useState<PhoenixUnit>('percent');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [marketOptions, setMarketOptions] = useState<DynamicRefOption[]>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [positions, setPositions] = useState<PhoenixTraderPosition[] | null>(null);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

  // DERIVED STATE
  const symbolOptions = marketOptions.map((option) => option.value);
  const marketBySymbol = new Map(marketOptions.map((option) => [option.value, option]));
  const hasSymbolCatalog = marketOptions.length > 0;
  const isCatalogUnavailable = !isLoadingSymbols && !hasSymbolCatalog;
  const marketSymbol = isLoadingSymbols ? '' : symbol.trim();
  const hasSymbol = !!marketSymbol;
  const isCustomSymbol = hasSymbol && !symbolOptions.includes(marketSymbol);
  const market = marketBySymbol.get(marketSymbol);
  const units = availableUnits(mode, market);
  const activeChoice = units.find((choice) => choice.unit === unit) ?? units[0];
  const rawAmount = activeChoice ? (toRawAmount(mode, activeChoice.unit, amount, market) ?? '') : '';
  const markUsd = (market?.markTicks ?? NaN) * usdPerTick(market);
  const markChange = (Number(rawAmount) / (market?.markTicks ?? NaN) - 1) * 100;
  const hint =
    mode === PhoenixStateMode.MarketMove && !!rawAmount && Number.isFinite(markUsd)
      ? `${formatUsd(markUsd)} → ${formatUsd(Number(rawAmount) * usdPerTick(market))} (${markChange > 0 ? '+' : ''}${Number(markChange.toFixed(1))}%), ${rawAmount} ticks`
      : !!activeChoice && activeChoice.unit !== 'raw' && !!rawAmount
        ? `Sends ${rawAmount} ${unitChoices[mode].at(-1)?.label.toLowerCase()}`
        : null;
  const hasTargetTicks = isWholeNumberInRange(rawAmount, 1, MAX_MARK_TICKS);
  // Phoenix refuses a maintenance factor at or below the market's backstop factor.
  const backstopBps = mode === PhoenixStateMode.MaintenanceMargin ? market?.backstopRiskFactorBps : undefined;
  const isAtOrBelowBackstop = backstopBps !== undefined && !!rawAmount && Number(rawAmount) <= backstopBps;
  const hasRiskFactor = isWholeNumberInRange(rawAmount, 1, MAX_RISK_FACTOR_BPS) && !isAtOrBelowBackstop;
  const traderAddress = trader.trim();
  const hasTraderAddress = isAddress(traderAddress);
  const isTraderInvalid = !!traderAddress && !hasTraderAddress;
  const isLiquidationReady = mode === PhoenixStateMode.LiquidationReady;
  const hasPositionSelection = selectedSymbols.length > 0;
  const sortedPositions = [...(positions ?? [])].sort(
    (a, b) => Number(b.maintenanceMarginQuoteLots) - Number(a.maintenanceMarginQuoteLots)
  );
  const isEveryPositionSelected = !!sortedPositions.length && selectedSymbols.length === sortedPositions.length;
  const selectionCount = `${selectedSymbols.length} of ${sortedPositions.length} selected`;
  const positionsStatus = isLoadingPositions
    ? 'Loading the positions of this trader…'
    : (positionsError ?? (positions?.length === 0 ? 'This trader holds no open Phoenix positions.' : null));
  const canCreate =
    !isCreating &&
    ((isLiquidationReady && hasTraderAddress && hasPositionSelection) ||
      (hasSymbol &&
        ((mode === PhoenixStateMode.MarketMove && hasTargetTicks) ||
          mode === PhoenixStateMode.LiquidationCascade ||
          (mode === PhoenixStateMode.MaintenanceMargin && hasRiskFactor))));

  // HELPERS
  const matchesMarket = (optionSymbol: string | null, query: string) => {
    if (!optionSymbol) return false;
    const search = query.trim().toLowerCase();
    const address = marketBySymbol.get(optionSymbol)?.address?.toLowerCase();
    return optionSymbol.toLowerCase().includes(search) || !!address?.includes(search);
  };

  const customMarketSymbol = (query: string) =>
    findOptionByTypedValue(
      marketOptions.map((option) => ({ id: option.value, label: option.value, ...option })),
      query
    )
      ? null
      : query;

  const renderPositionOption = (position: PhoenixTraderPosition) => (
    <PositionOption
      key={position.symbol}
      position={position}
      size={formatPositionSize(position, marketBySymbol.get(position.symbol))}
      checked={selectedSymbols.includes(position.symbol)}
      disabled={isCreating}
      onToggle={handlePositionToggle}
    />
  );

  const renderMarketOption = (optionSymbol: string) => (
    <ComboboxOption key={optionSymbol} value={optionSymbol}>
      <ComboboxLabel>{optionSymbol}</ComboboxLabel>
      <ComboboxDescription>{marketBySymbol.get(optionSymbol)?.address ?? 'Custom symbol'}</ComboboxDescription>
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
    setUnit(unitChoices[selectedMode][0]?.unit ?? 'raw');
    setAmount('');
    setError(null);
  };

  const handleUnitChange = (selectedUnit: PhoenixUnit) => {
    setUnit(selectedUnit);
    setError(null);
  };

  const handleTraderChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTrader(event.target.value);
    setError(null);
  };

  const handlePositionToggle = (positionSymbol: string, isChecked: boolean) => {
    setSelectedSymbols((current) =>
      isChecked ? [...current, positionSymbol] : current.filter((selected) => selected !== positionSymbol)
    );
    setError(null);
  };

  const handleSelectAllToggle = () => {
    setSelectedSymbols(isEveryPositionSelected ? [] : sortedPositions.map((position) => position.symbol));
    setError(null);
  };

  const handleSideChange = (selectedSide: CascadeSide) => {
    setSide(selectedSide);
    setError(null);
  };

  const handleSymbolChange = (pickedSymbol: string | null) => {
    if (!pickedSymbol) return;
    const pickedUnits = availableUnits(mode, marketBySymbol.get(pickedSymbol));
    const pickedUnit = (pickedUnits.find((choice) => choice.unit === unit) ?? pickedUnits[0])?.unit;
    const isUnitChange = !!pickedUnit && pickedUnit !== activeChoice?.unit;
    const isOtherMarket = !!marketSymbol && pickedSymbol !== marketSymbol;
    // The same amount means something else in another unit, so 10% must not become 10 ticks, and a USD or
    // tick amount names another price on another market; only a % carries over.
    if (isUnitChange) setUnit(pickedUnit);
    if (isUnitChange || (isOtherMarket && pickedUnit !== 'percent')) setAmount('');
    setSymbol(pickedSymbol);
    setError(null);
  };

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    // The amount means the unit shown beside it, also the ticks shown while markets load.
    if (activeChoice) setUnit(activeChoice.unit);
    setAmount(event.target.value);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const fetchBeforeUse = !keepEarlierChanges;
      const result =
        mode === PhoenixStateMode.MarketMove
          ? await createPhoenixMarketMoveScenario(studioUrl, marketSymbol, rawAmount, fetchBeforeUse)
          : isLiquidationReady
            ? await createPhoenixLiquidationReadyScenario(
                studioUrl,
                trader,
                [...selectedSymbols].sort(),
                fetchBeforeUse
              )
            : mode === PhoenixStateMode.LiquidationCascade
              ? await createPhoenixLiquidationCascadeScenario(studioUrl, marketSymbol, side, fetchBeforeUse)
              : await createPhoenixMaintenanceMarginScenario(studioUrl, marketSymbol, rawAmount, fetchBeforeUse);
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
      setSymbol((current) => current || (options.find((option) => option.value === 'BTC') ?? options[0])?.value || '');
      setIsLoadingSymbols(false);
    };

    fetchDynamicRefOptions(studioUrl, rpcUrl, 'list_phoenix_markets').then(handleSymbolsLoaded);

    return () => {
      cancelled = true;
    };
  }, [open, studioUrl, rpcUrl]);

  useEffect(() => {
    setSelectedSymbols([]);
    setPositions(null);
    setPositionsError(null);
    if (!open || !isLiquidationReady || !hasTraderAddress) return;
    let cancelled = false;

    setIsLoadingPositions(true);

    const handlePositionsLoaded = (loaded: PhoenixTraderPosition[]) => {
      if (cancelled) return;
      setPositions(loaded);
      setIsLoadingPositions(false);
    };

    const handlePositionsFailed = (failure: unknown) => {
      if (cancelled) return;
      setPositionsError(failure instanceof Error ? failure.message : 'Could not load the positions of this trader.');
      setIsLoadingPositions(false);
    };

    fetchPhoenixTraderPositions(studioUrl, rpcUrl, traderAddress).then(handlePositionsLoaded, handlePositionsFailed);

    return () => {
      cancelled = true;
    };
  }, [open, isLiquidationReady, hasTraderAddress, traderAddress, studioUrl, rpcUrl]);

  const amountField = activeChoice ? (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-zinc-300">{amountLabel[mode]}</span>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            aria-label={amountLabel[mode]}
            placeholder={activeChoice.placeholder}
            value={amount}
            onChange={handleAmountChange}
          />
        </div>
        <div className="w-36">
          <Listbox aria-label="Unit" value={activeChoice.unit} onChange={handleUnitChange} disabled={isCreating}>
            {units.map(renderUnitOption)}
          </Listbox>
        </div>
      </div>
      {!!hint && <p className="mt-1.5 text-sm text-zinc-400">{hint}</p>}
      {isAtOrBelowBackstop && (
        <p role="status" className="mt-1.5 text-sm text-red-400">
          Must be above the backstop factor ({backstopBps} bps).
        </p>
      )}
    </div>
  ) : null;

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
            <p className="mt-1.5 text-sm text-zinc-400">{PhoenixStateModeHint[mode]}</p>
          </div>

          {mode === PhoenixStateMode.LiquidationReady && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-zinc-300">Trader account</span>
              <Input
                aria-label="Phoenix Trader account"
                placeholder="Address of the Phoenix Trader account"
                value={trader}
                onChange={handleTraderChange}
                spellCheck={false}
                autoComplete="off"
              />
              {isTraderInvalid && (
                <p role="status" className="mt-1.5 text-sm text-red-400">
                  Not a valid Solana address.
                </p>
              )}
            </div>
          )}
          {isLiquidationReady && hasTraderAddress && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium text-zinc-300">Positions to liquidate</span>
                {!!sortedPositions.length && (
                  <span className="flex items-baseline gap-3 text-xs text-zinc-500">
                    {selectionCount}
                    <button
                      type="button"
                      onClick={handleSelectAllToggle}
                      disabled={isCreating}
                      className="font-medium text-purple-400 hover:text-purple-300 disabled:opacity-50"
                    >
                      {isEveryPositionSelected ? 'Clear' : 'Select all'}
                    </button>
                  </span>
                )}
              </div>
              {positionsStatus ? (
                <p role="status" className="text-sm text-zinc-400">
                  {positionsStatus}
                </p>
              ) : (
                <CheckboxGroup className="max-h-72 space-y-0 divide-y divide-zinc-800 overflow-y-auto rounded-xl border border-zinc-700/60 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {sortedPositions.map(renderPositionOption)}
                </CheckboxGroup>
              )}
            </div>
          )}
          {!isLiquidationReady && (
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
          )}
          {mode === PhoenixStateMode.LiquidationCascade && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-zinc-300">Positions to liquidate</span>
              <Listbox
                aria-label="Positions to liquidate"
                value={side}
                onChange={handleSideChange}
                disabled={isCreating}
              >
                {cascadeSides.map(renderCascadeSideOption)}
              </Listbox>
            </div>
          )}
          {amountField}
          <div className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-zinc-300">Keep earlier Phoenix changes</span>
              <span className="mt-0.5 block text-sm text-zinc-400">
                Off, Play refetches this scenario&apos;s own account from upstream (the trader, or the market map),
                dropping earlier changes to it; on, it keeps what is on this surfnet.
              </span>
            </span>
            <Switch
              aria-label="Keep earlier Phoenix changes"
              checked={keepEarlierChanges}
              onChange={setKeepEarlierChanges}
              disabled={isCreating}
              color="purple"
              className="mt-0.5 shrink-0"
            />
          </div>
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
