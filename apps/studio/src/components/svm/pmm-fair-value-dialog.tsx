'use client';

import {
  createGoonfiPriceScenario,
  createTesseraFairValueScenario,
  fetchGoonfiMarkets,
  fetchTesseraMarkets,
  type PmmMarketOption,
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

interface PmmFairValueDialogProps {
  open: boolean;
  studioUrl: string;
  onClose: () => void;
  onCreated: (scenarioId: string) => void;
}

type PmmProtocol = 'tessera' | 'goonfi';

const renderMarketOption = (market: PmmMarketOption) => (
  <ListboxOption key={market.value} value={market.value}>
    {market.label}
  </ListboxOption>
);

const priceLabelFor = (market: PmmMarketOption | undefined) => {
  const [base, quote] = market?.label.split('/') ?? [];
  return base && quote ? `Price of ${base} in ${quote}` : 'Price in quote tokens';
};

export default function PmmFairValueDialog({ open, studioUrl, onClose, onCreated }: PmmFairValueDialogProps) {
  // STATE
  const [protocol, setProtocol] = useState<PmmProtocol>('tessera');
  const [market, setMarket] = useState('');
  const [price, setPrice] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [marketOptions, setMarketOptions] = useState<PmmMarketOption[] | null>(null);

  // DERIVED STATE
  const normalizedPrice = price.trim();
  const normalizedMarket = market.trim();
  const isGoonfi = protocol === 'goonfi';
  const protocolLabel = isGoonfi ? 'GoonFi' : 'Tessera';
  const pricePattern = isGoonfi ? /^\d+(?:\.\d{1,6})?$/ : /^\d+(?:\.\d{1,12})?$/;
  const hasValidPrice = pricePattern.test(normalizedPrice) && /[1-9]/.test(normalizedPrice);
  const hasMarketCatalog = !!marketOptions && marketOptions.length > 0;
  const selectedMarket = marketOptions?.find((option) => option.value === normalizedMarket);
  const hasValidMarket = !normalizedMarket || !hasMarketCatalog || !!selectedMarket;
  const canCreate = marketOptions !== null && hasValidPrice && hasValidMarket && !isCreating;
  const priceLabel = priceLabelFor(selectedMarket ?? marketOptions?.[0]);

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleProtocolSelect = (selectedValue: string) => {
    if (selectedValue !== 'tessera' && selectedValue !== 'goonfi') return;
    // Reselecting the current protocol must not clear the catalog: `protocol` would not change, so
    // the effect that reloads it never reruns and the dialog stays stuck on "Loading markets…".
    if (selectedValue === protocol) return;
    setProtocol(selectedValue);
    setPrice(selectedValue === 'goonfi' ? '' : '100');
    setMarket('');
    setMarketOptions(null);
    setError(null);
  };

  const handleMarketSelect = (selectedValue: string) => {
    setMarket(selectedValue);
    setError(null);
  };

  const handleMarketInput = (event: ChangeEvent<HTMLInputElement>) => {
    setMarket(event.target.value);
    setError(null);
  };

  const handlePriceChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPrice(event.target.value);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = isGoonfi
        ? await createGoonfiPriceScenario(studioUrl, normalizedMarket, normalizedPrice)
        : await createTesseraFairValueScenario(studioUrl, normalizedMarket, normalizedPrice);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Failed to create ${protocolLabel} scenario`);
    } finally {
      setIsCreating(false);
    }
  };

  // EFFECTS
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMarketOptions(null);

    const handleMarketsLoaded = (options: PmmMarketOption[]) => {
      if (!cancelled) {
        setMarketOptions(options);
        setMarket((current) => {
          if (options.length === 0) return current;
          return options.some((option) => option.value === current.trim()) ? current.trim() : options[0].value;
        });
      }
    };

    const markets = protocol === 'goonfi' ? fetchGoonfiMarkets(studioUrl) : fetchTesseraMarkets(studioUrl);
    markets.then(handleMarketsLoaded);

    return () => {
      cancelled = true;
    };
  }, [open, studioUrl, protocol]);

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create PMM fair value</DialogTitle>
        <DialogDescription>
          Choose a PMM and market, then set the price of one base token in quote tokens. Surfpool validates the live
          market and keeps its quote fresh. No swap is sent.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">PMM protocol</span>
            <Listbox aria-label="PMM protocol" value={protocol} onChange={handleProtocolSelect} disabled={isCreating}>
              <ListboxOption value="tessera">Tessera</ListboxOption>
              <ListboxOption value="goonfi">GoonFi</ListboxOption>
            </Listbox>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Market</span>
            {marketOptions === null ? (
              <Input aria-label="PMM market" placeholder="Loading markets…" value="" disabled readOnly />
            ) : marketOptions.length > 0 ? (
              <Listbox aria-label="PMM market" value={market} onChange={handleMarketSelect} disabled={isCreating}>
                {marketOptions.map(renderMarketOption)}
              </Listbox>
            ) : (
              <Input
                aria-label="PMM market"
                placeholder="Leave empty for the default market"
                value={market}
                onChange={handleMarketInput}
                disabled={isCreating}
              />
            )}
            {marketOptions?.length === 0 && (
              <p className="mt-1.5 text-xs text-zinc-500">
                Live market list unavailable. Enter a market account address, or leave it empty to use the default.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="pmm-fair-value-price" className="mb-1.5 block text-sm font-medium text-zinc-300">
              {priceLabel}
            </label>
            <Input
              id="pmm-fair-value-price"
              inputMode="decimal"
              placeholder="100.25"
              value={price}
              onChange={handlePriceChange}
              disabled={isCreating}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              {isGoonfi
                ? 'Positive decimal with up to 6 places. Sets equal bid and ask and updates their protective reference prices.'
                : 'Positive decimal with up to 12 places.'}
            </p>
          </div>
          {!!error && <p className="text-sm text-red-400">{error}</p>}
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
