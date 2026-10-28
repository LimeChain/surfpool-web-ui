export type TokenSelectorOption = {
  id: string;
  label?: string;
  value?: string | number;
  address?: string;
  metadata?: {
    symbol?: string;
    logo_uri?: string;
  };
  description?: string;
};

export const getSolFiCustomAccountKind = (protocol: unknown, templateId: unknown) => {
  if (protocol !== 'SolFi' || typeof templateId !== 'string') return undefined;
  if (templateId === 'solfi-price') return 'oracle';
  if (templateId === 'solfi-vault-balance') return 'vault';
  if (templateId === 'solfi-size-impact' || templateId === 'solfi-swap-pressure') return 'market';
  return undefined;
};

export const isSolFiTemplate = (templateId: unknown) =>
  typeof templateId === 'string' && templateId.startsWith('solfi-');

const SOLFI_FEATURED_MARKETS = [
  {
    id: 'sol-usdc',
    label: 'SOL / USDC',
    market: '65ZHSArs5XxPseKQbB1B4r16vDxMWnCxHMzogDAqiDUc',
    oracle: '2ny7eGyZCoeEVTkNLf5HcnJFBKkyA4p4gcrtb3b8y8ou',
    baseSymbol: 'SOL',
    baseVault: 'CRo8DBwrmd97DJfAnvCv96tZPL5Mktf2NZy2ZnhDer1A',
    quoteSymbol: 'USDC',
    quoteVault: 'GhFfLFSprPpfoRaWakPMmJTMJBHuz6C694jYwxy2dAic',
  },
  {
    id: 'usdt-usdc',
    label: 'USDT / USDC',
    market: 'FkEB6uvyzuoaGpgs4yRtFtxC4WJxhejNFbUkj5R6wR32',
    oracle: 'CyCUgmaCYUZxbux3J2svDzxSryVFMtZNPrnMKS41nc4G',
    baseSymbol: 'USDT',
    baseVault: '5bHD9xdEzJdkVuhs54mGPC9BZgUshqgMg4tqmTwhWggc',
    quoteSymbol: 'USDC',
    quoteVault: 'ARWaajRJyF6PKQryJ4HLzLBfTWM2qmVQUQVtBjk6PgPc',
  },
  {
    id: 'hype-usdc',
    label: 'HYPE / USDC',
    market: '2e25gRiddjn968aXrLt1oZw3BZ4fYD5D8mCv7uKxu1yL',
    oracle: '9WDWUT9tx9Z2DKgiuzSsPS3dEBTRnPrzpuWrMHaRgACU',
    baseSymbol: 'HYPE',
    baseVault: '7DEGUxRtaphAUcdwvZTjVUM2yUM7r3EVWu16FxRZrYjP',
    quoteSymbol: 'USDC',
    quoteVault: '7RhQGDQgSx3YrQHBjG2BVdZpm8c54o6uSW9p6ckyb8uQ',
  },
  {
    id: 'pump-usdc',
    label: 'PUMP / USDC',
    market: '2kfQuYG2FVZL2RqqKEttcdadbPWP4c7b6AFQztNcBWyV',
    oracle: '5VTjvi4XhRCXUSitDGJXVp5iZpU2sypNAT5EvEvaXR6j',
    baseSymbol: 'PUMP',
    baseVault: '8PbjFCfVNHH5PwP7xJj4JnGom397ybK3mLzw9164nZ4K',
    quoteSymbol: 'USDC',
    quoteVault: 'CMghWj6TEDfGTN5CSzo9p27kPMb73fsDPM22LqTe2C9y',
  },
] as const;

const getSolFiAiContext = () =>
  [
    'Featured SolFi accounts available in Studio:',
    ...SOLFI_FEATURED_MARKETS.map(
      (market) =>
        `- ${market.label}: market ${market.market}; oracle ${market.oracle}; ` +
        `${market.baseSymbol} vault ${market.baseVault}; ` +
        `${market.quoteSymbol} vault ${market.quoteVault}.`
    ),
  ].join('\n');

const PROTOCOL_AI_CONTEXT: Partial<Record<string, () => string>> = {
  solfi: getSolFiAiContext,
};

export const getProtocolAiContext = (protocolId: string): string | undefined =>
  PROTOCOL_AI_CONTEXT[protocolId]?.();

export const getSolFiAccountOptions = (accountKind: 'market' | 'oracle' | 'vault'): TokenSelectorOption[] => {
  if (accountKind === 'market') {
    return SOLFI_FEATURED_MARKETS.map((market) => ({
      id: market.id,
      label: market.label,
      value: market.market,
      description: 'Market account',
    }));
  }
  if (accountKind === 'oracle') {
    return SOLFI_FEATURED_MARKETS.map((market) => ({
      id: market.id,
      label: market.label,
      value: market.oracle,
      description: 'Oracle account',
    }));
  }
  return SOLFI_FEATURED_MARKETS.flatMap((market) => [
    {
      id: `${market.id}-base`,
      label: `${market.label} (${market.baseSymbol} vault)`,
      value: market.baseVault,
      description: 'Base payout vault',
    },
    {
      id: `${market.id}-quote`,
      label: `${market.label} (${market.quoteSymbol} vault)`,
      value: market.quoteVault,
      description: 'Quote payout vault',
    },
  ]);
};

// The oracle of the featured market a SolFi market or vault account belongs to.
export const getSolFiFeaturedOracle = (accountPubkey: string): string | undefined =>
  SOLFI_FEATURED_MARKETS.find(
    (market) =>
      market.market === accountPubkey || market.baseVault === accountPubkey || market.quoteVault === accountPubkey
  )?.oracle;

export const resolveSolFiAccount = (templateId: unknown, templateAddress: unknown, selectedPubkey: string) => {
  if (!isSolFiTemplate(templateId)) return templateAddress;
  const pubkey = selectedPubkey.trim();
  return pubkey ? { pubkey } : undefined;
};

export const customValueOption = (value: string): TokenSelectorOption => ({
  id: `custom-${value}`,
  label: 'Custom value',
  value,
  metadata: { symbol: `Custom · ${value}` },
});

export const findOptionByTypedValue = (options: TokenSelectorOption[], typedValue: string) => {
  const typed = typedValue.trim();
  if (!typed) return undefined;
  const lowered = typed.toLowerCase();
  return options.find((option) => {
    const value = option.value != null ? String(option.value) : '';
    const sameValue = typed.startsWith('0x') ? value.toLowerCase() === lowered : value === typed;
    return (
      sameValue ||
      option.address === typed ||
      option.metadata?.symbol?.toLowerCase() === lowered ||
      option.label?.toLowerCase() === lowered
    );
  });
};

export const resolveTokenSelectorOptions = (
  catalogOptions: TokenSelectorOption[],
  currentValue: string | number | undefined
) => {
  const currentValueString = currentValue != null ? String(currentValue) : '';
  const catalogOption = catalogOptions.find((option) =>
    currentValueString.startsWith('0x')
      ? String(option.value).toLowerCase() === currentValueString.toLowerCase()
      : option.value === currentValueString
  );
  const customOption = !catalogOption && currentValueString ? customValueOption(currentValueString) : null;

  return {
    options: customOption ? [customOption, ...catalogOptions] : catalogOptions,
    selectedOption: catalogOption || customOption,
  };
};
