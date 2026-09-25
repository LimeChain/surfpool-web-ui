'use client';

import {
  buildPmmFairValueScenario,
  isValidPmmPrice,
  marketPairLabel,
  PMM_FAIR_VALUE_ADAPTERS,
  type PmmFairValueAdapter,
  type PmmMarketOption,
  type PmmProtocol,
  PmmProtocols,
  readMarketOptions,
} from '@/lib/pmm-fair-value';
import { createTemplateScenario, fetchScenarioTemplate } from '@/lib/scenarios-api';
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

const renderProtocolOption = (adapter: PmmFairValueAdapter) => (
  <ListboxOption key={adapter.protocol} value={adapter.protocol}>
    {adapter.label}
  </ListboxOption>
);

const renderMarketOption = (market: PmmMarketOption) => (
  <ListboxOption key={market.value} value={market.value}>
    {market.label}
  </ListboxOption>
);

export default function PmmFairValueDialog({ open, studioUrl, onClose, onCreated }: PmmFairValueDialogProps) {
  // STATE
  const [protocol, setProtocol] = useState<PmmProtocol>(PmmProtocols.Tessera);
  const [market, setMarket] = useState('');
  const [price, setPrice] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [marketOptions, setMarketOptions] = useState<PmmMarketOption[] | null>(null);

  // DERIVED STATE
  const adapter = PMM_FAIR_VALUE_ADAPTERS[protocol];
  const selectedMarket = marketOptions?.find((option) => option.value === market);
  const canCreate = !!selectedMarket && isValidPmmPrice(price) && !isCreating;
  const priceLabel = marketPairLabel(selectedMarket);

  // HANDLERS
  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    onClose();
  };

  const handleProtocolSelect = (selectedProtocol: PmmProtocol) => {
    setProtocol(selectedProtocol);
    setError(null);
  };

  const handleMarketSelect = (selectedValue: string) => {
    setMarket(selectedValue);
    setError(null);
  };

  const handlePriceChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPrice(event.target.value);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || !selectedMarket) return;

    setIsCreating(true);
    setError(null);

    try {
      const scenario = buildPmmFairValueScenario(adapter, selectedMarket, price);
      const result = await createTemplateScenario(studioUrl, scenario);
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Failed to create ${adapter.label} fair value`);
    } finally {
      setIsCreating(false);
    }
  };

  // EFFECTS
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMarketOptions(null);

    fetchScenarioTemplate(studioUrl, adapter.marketTemplateId)
      .then((template) => {
        if (cancelled) return;
        const options = readMarketOptions(template);
        setMarketOptions(options);
        setMarket((current) =>
          options.some((option) => option.value === current) ? current : (options[0]?.value ?? '')
        );
        if (options.length === 0) setError(`No ${adapter.label} markets are listed in the template catalog`);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setMarketOptions([]);
        setError(loadError instanceof Error ? loadError.message : `Failed to load ${adapter.label} markets`);
      });

    return () => {
      cancelled = true;
    };
  }, [open, studioUrl, adapter]);

  return (
    <Dialog open={open} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create PMM fair value</DialogTitle>
        <DialogDescription>
          Choose a PMM and market, then set the price of one base token in quote tokens. The scenario moves the
          maker&apos;s quote to that price and marks it fresh. No swap is sent.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">PMM protocol</span>
            <Listbox aria-label="PMM protocol" value={protocol} onChange={handleProtocolSelect} disabled={isCreating}>
              {Object.values(PMM_FAIR_VALUE_ADAPTERS).map(renderProtocolOption)}
            </Listbox>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">Market</span>
            <Listbox
              aria-label="PMM market"
              placeholder={marketOptions === null ? 'Loading markets…' : undefined}
              value={market}
              onChange={handleMarketSelect}
              disabled={isCreating || !marketOptions?.length}
            >
              {marketOptions?.map(renderMarketOption)}
            </Listbox>
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
              Positive decimal. The raw fields are derived from the selected market and its catalog metadata.
            </p>
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
