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
import { createTemplateScenario, fetchScenarioTemplates, type ScenarioTemplate } from '@/lib/scenarios-api';
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
  const [templates, setTemplates] = useState<ScenarioTemplate[] | null>(null);

  // DERIVED STATE
  const availableAdapters = Object.values(PMM_FAIR_VALUE_ADAPTERS).filter(
    (candidate) => !!templates?.some((template) => template.id === candidate.marketTemplateId)
  );
  const adapter = availableAdapters.find((candidate) => candidate.protocol === protocol) ?? availableAdapters[0];
  const marketTemplate = templates?.find((template) => template.id === adapter?.marketTemplateId);
  const marketOptions = templates === null ? null : marketTemplate ? readMarketOptions(marketTemplate) : [];
  const selectedMarket = marketOptions?.find((option) => option.value === market) ?? marketOptions?.[0];
  const canCreate = !!selectedMarket && isValidPmmPrice(price) && !isCreating;
  const priceLabel = marketPairLabel(selectedMarket);
  const catalogError =
    templates === null
      ? null
      : !adapter
        ? 'This surfnet serves no PMM fair value templates'
        : marketOptions?.length === 0
          ? `No ${adapter.label} markets are listed in the template catalog`
          : null;
  const visibleError = error ?? catalogError;

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
    if (!canCreate || !selectedMarket || !adapter) return;

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
    setTemplates(null);

    fetchScenarioTemplates(studioUrl)
      .then((loadedTemplates) => {
        if (!cancelled) setTemplates(loadedTemplates);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setTemplates([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load PMM markets');
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
          Choose a PMM and market, then set the price of one base token in quote tokens. The scenario moves the
          maker&apos;s quote to that price and marks it fresh. No swap is sent.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-300">PMM protocol</span>
            <Listbox
              aria-label="PMM protocol"
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
            <Listbox
              aria-label="PMM market"
              placeholder={marketOptions === null ? 'Loading markets…' : undefined}
              value={selectedMarket?.value ?? ''}
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
