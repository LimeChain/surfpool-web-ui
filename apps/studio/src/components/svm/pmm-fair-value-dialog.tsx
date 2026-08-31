'use client';

import { createTesseraFairValueScenario, fetchTesseraMarkets, type TesseraMarketOption } from '@/lib/scenarios-api';
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

const renderMarketOption = (market: TesseraMarketOption) => (
  <ListboxOption key={market.value} value={market.value}>
    {market.label}
  </ListboxOption>
);

const priceLabelFor = (market: TesseraMarketOption | undefined) => {
  const [base, quote] = market?.label.split('/') ?? [];
  return base && quote ? `Price of ${base} in ${quote}` : 'Price in quote tokens';
};

export default function PmmFairValueDialog({ open, studioUrl, onClose, onCreated }: PmmFairValueDialogProps) {
  // STATE
  const [market, setMarket] = useState('');
  const [price, setPrice] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [marketOptions, setMarketOptions] = useState<TesseraMarketOption[] | null>(null);

  // DERIVED STATE
  const normalizedPrice = price.trim();
  const normalizedMarket = market.trim();
  const hasValidPrice = /^\d+(?:\.\d{1,12})?$/.test(normalizedPrice) && /[1-9]/.test(normalizedPrice);
  const hasMarketCatalog = !!marketOptions && marketOptions.length > 0;
  const selectedMarket = marketOptions?.find((option) => option.value === normalizedMarket);
  const hasValidMarket = !normalizedMarket || !hasMarketCatalog || !!selectedMarket;
  const canCreate = hasValidPrice && hasValidMarket && !isCreating;
  const priceLabel = priceLabelFor(selectedMarket ?? marketOptions?.[0]);

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleProtocolSelect = () => {
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
      const result = await createTesseraFairValueScenario(studioUrl, normalizedMarket, normalizedPrice);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Failed to create Tessera fair-value scenario');
    } finally {
      setIsCreating(false);
    }
  };

  // EFFECTS
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMarketOptions(null);

    fetchTesseraMarkets(studioUrl).then((options) => {
      if (!cancelled) setMarketOptions(options);
    });

    return () => {
      cancelled = true;
    };
  }, [open, studioUrl]);

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
            <Listbox aria-label="PMM protocol" value="tessera" onChange={handleProtocolSelect} disabled={isCreating}>
              <ListboxOption value="tessera">Tessera</ListboxOption>
            </Listbox>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Market</span>
            {marketOptions === null ? (
              <Input aria-label="PMM market" placeholder="Loading markets…" value="" disabled readOnly />
            ) : marketOptions.length > 0 ? (
              <Listbox aria-label="PMM market" value={market} onChange={handleMarketSelect} disabled={isCreating}>
                <ListboxOption value="">Default market ({marketOptions[0].label})</ListboxOption>
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
                Market account address, or leave it empty to use the default.
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
              Positive decimal with up to 12 places. The backend derives both atomic ratio fields from the market&apos;s
              mint decimals.
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
