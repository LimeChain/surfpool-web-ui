'use client';

import {
  buildMarketMoveScenario,
  createMarketMoveScenario,
  fetchServedTemplates,
  knownTokenSymbols,
  type MarketMoveAdapter,
  type MarketMoveMarket,
  parseMarketMove,
  type ServedTemplate,
} from '@/lib/market-move';
import { MARKET_MOVE_ADAPTERS } from '@/lib/market-move-adapters';
import { isAddress } from '@solana/kit';
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
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';

interface MarketMoveDialogProps {
  open: boolean;
  studioUrl: string;
  rpcUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

const renderProtocolOption = (adapter: MarketMoveAdapter) => (
  <ListboxOption key={adapter.protocol} value={adapter.protocol}>
    {adapter.label}
  </ListboxOption>
);

const displayMarket = (market: MarketMoveMarket | null) => market?.label;

const normalizeSearch = (text: string) => text.replace(/\s+/g, '').toLowerCase();

const matchesMarket = (market: MarketMoveMarket | null, query: string) => {
  if (!market) return false;
  const search = normalizeSearch(query);
  return normalizeSearch(market.label).includes(search) || normalizeSearch(market.value).includes(search);
};

const renderMarketOption = (market: MarketMoveMarket) => (
  <ComboboxOption key={market.value} value={market}>
    <ComboboxLabel>{market.label}</ComboboxLabel>
    <ComboboxDescription>{market.value}</ComboboxDescription>
  </ComboboxOption>
);

const messageOf = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export default function MarketMoveDialog({ open, studioUrl, rpcUrl, onClose, onCreated }: MarketMoveDialogProps) {
  // STATE
  const [protocol, setProtocol] = useState<string | null>(null);
  const [market, setMarket] = useState('');
  const [move, setMove] = useState('-10');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [templates, setTemplates] = useState<ServedTemplate[] | null>(null);
  const [markets, setMarkets] = useState<MarketMoveMarket[] | null>(null);
  const [customMarket, setCustomMarket] = useState<MarketMoveMarket | null>(null);

  // DERIVED STATE
  const availableAdapters = MARKET_MOVE_ADAPTERS.filter(
    (candidate) => !!templates?.some((template) => template.id === candidate.templateId)
  );
  const adapter = availableAdapters.find((candidate) => candidate.protocol === protocol) ?? availableAdapters[0];
  const listedMarket = markets?.find((option) => option.value === market);
  const loadedCustomMarket = customMarket?.value === market ? customMarket : undefined;
  const selectedMarket = listedMarket ?? (market === '' ? markets?.[0] : loadedCustomMarket);
  const pickerOptions = loadedCustomMarket ? [...(markets ?? []), loadedCustomMarket] : (markets ?? []);
  const parsedMove = parseMarketMove(move);
  const canCreate = !!adapter && !!selectedMarket && !!parsedMove && !isCreating;
  const isLoadingMarkets = !!adapter && markets === null;
  const servedError = templates !== null && !adapter ? 'This surfnet serves no market move templates' : null;
  const visibleError = error ?? servedError;

  // REFS
  const marketRequestRef = useRef(0);

  // HELPERS
  const typedMarket = (query: string): MarketMoveMarket | null =>
    isAddress(query) && !pickerOptions.some((option) => option.value === query)
      ? { label: `Custom · ${query}`, value: query, account: query }
      : null;

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    marketRequestRef.current++;
    setError(null);
    onClose();
  };

  const handleProtocolSelect = (selectedProtocol: string) => {
    if (selectedProtocol === adapter?.protocol) return;
    marketRequestRef.current++;
    setProtocol(selectedProtocol);
    setMarkets(null);
    setMarket('');
    setCustomMarket(null);
    setError(null);
  };

  const handleMarketSelect = (option: MarketMoveMarket | null) => {
    if (!option || !adapter) return;
    const address = option.value;
    const requestId = ++marketRequestRef.current;
    setMarket(address);
    setError(null);
    if (markets?.some((listed) => listed.value === address) || customMarket?.value === address) return;
    adapter
      .readMarket(rpcUrl, address, knownTokenSymbols(templates ?? []))
      .then((read) => {
        if (requestId === marketRequestRef.current) setCustomMarket(read);
      })
      .catch((readError: unknown) => {
        if (requestId === marketRequestRef.current) setError(messageOf(readError, `Failed to read ${address}`));
      });
  };

  const handleMoveChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMove(event.target.value);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || !adapter || !selectedMarket || !parsedMove) return;

    setIsCreating(true);
    setError(null);

    try {
      const overrides = await adapter.buildOverrides(rpcUrl, selectedMarket, parsedMove);
      const scenario = buildMarketMoveScenario(adapter, selectedMarket, parsedMove, overrides);
      const result = await createMarketMoveScenario(studioUrl, scenario);
      onCreated(result.id);
    } catch (createError) {
      setError(messageOf(createError, `Failed to create the ${adapter.label} market move`));
    } finally {
      setIsCreating(false);
    }
  };

  // EFFECTS
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTemplates(null);

    fetchServedTemplates(studioUrl)
      .then((loadedTemplates) => {
        if (!cancelled) setTemplates(loadedTemplates);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setTemplates([]);
        setError(messageOf(loadError, 'Failed to load scenario templates'));
      });

    return () => {
      cancelled = true;
    };
  }, [open, studioUrl]);

  useEffect(() => {
    if (!open || !adapter || templates === null) return;
    let cancelled = false;
    setMarkets(null);

    adapter
      .listMarkets(rpcUrl, knownTokenSymbols(templates))
      .then((loadedMarkets) => {
        if (!cancelled) setMarkets(loadedMarkets);
      })
      .catch((listError: unknown) => {
        if (cancelled) return;
        setMarkets([]);
        setError(messageOf(listError, `Failed to list ${adapter.label} markets`));
      });

    return () => {
      cancelled = true;
    };
  }, [open, adapter, templates, rpcUrl]);

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create market move</DialogTitle>
        <DialogDescription>
          Choose a protocol and market, then move its price by a percentage. The scenario rewrites the price the
          protocol reads and opens in the editor. No trade is sent.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Protocol</span>
            <Listbox
              aria-label="Market move protocol"
              placeholder={templates === null ? 'Loading protocols…' : undefined}
              value={adapter?.protocol ?? ''}
              onChange={handleProtocolSelect}
              disabled={isCreating || !availableAdapters.length}
            >
              {availableAdapters.map(renderProtocolOption)}
            </Listbox>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Market</span>
            <Combobox<MarketMoveMarket | null>
              aria-label="Market move market"
              placeholder={isLoadingMarkets ? 'Loading markets…' : 'Search by pair or paste an address'}
              options={pickerOptions}
              value={selectedMarket ?? null}
              by="value"
              immediate
              displayValue={displayMarket}
              filter={matchesMarket}
              customOption={typedMarket}
              onChange={handleMarketSelect}
              disabled={isCreating || !adapter || isLoadingMarkets}
            >
              {renderMarketOption}
            </Combobox>
          </div>
          <div>
            <label htmlFor="market-move-percent" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Move (%)
            </label>
            <Input
              id="market-move-percent"
              inputMode="decimal"
              placeholder="-20"
              value={move}
              onChange={handleMoveChange}
              disabled={isCreating}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Negative moves the price down: -20 is a 20% drop. At most four decimals.
            </p>
          </div>
          {!!visibleError && <p className="text-sm text-red-400">{visibleError}</p>}
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
