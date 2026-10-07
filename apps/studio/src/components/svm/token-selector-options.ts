import { GOONFI_FEATURED_MARKETS } from '@/lib/goonfi-markets';

export type TokenSelectorOption = {
  id: string;
  label?: string;
  value?: string | number;
  metadata?: {
    symbol?: string;
    logo_uri?: string;
  };
  description?: string;
};

export const shouldUseConstantCombobox = (optionCount: number, isAccountSelector: boolean) =>
  isAccountSelector || optionCount > 20;

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
  const customOption =
    !catalogOption && currentValueString
      ? {
          id: `custom-${currentValueString}`,
          label: 'Custom value',
          value: currentValueString,
          metadata: { symbol: `Custom · ${currentValueString}` },
        }
      : null;

  return {
    options: customOption ? [customOption, ...catalogOptions] : catalogOptions,
    selectedOption: catalogOption || customOption,
  };
};

const PUBKEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const isAccountAddress = (text: string) => PUBKEY_PATTERN.test(text);

// A typed account address an account picker does not list yet, offered as its last option.
export const typedAccountOption = (
  query: string,
  options: ReadonlyArray<{ value?: string | number }>
): TokenSelectorOption | null =>
  isAccountAddress(query) && !options.some((option) => option.value === query)
    ? { id: `custom-${query}`, label: 'Custom address', value: query, metadata: { symbol: `Custom · ${query}` } }
    : null;

export type FeaturedAccounts = {
  label: string;
  description: string;
  options: TokenSelectorOption[];
};

const goonfiAccounts = (kind: 'market' | 'oracle' | 'vault'): FeaturedAccounts => ({
  label: `GoonFi ${kind}`,
  description: 'Pick a featured market or type any GoonFi account address.',
  options:
    kind === 'vault'
      ? GOONFI_FEATURED_MARKETS.flatMap((market) => [
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
        ])
      : GOONFI_FEATURED_MARKETS.map((market) => ({
          id: market.id,
          label: market.label,
          value: kind === 'oracle' ? market.oracle : market.market,
          description: kind === 'oracle' ? 'Oracle account' : 'Market account',
        })),
});

// Templates that write a caller-selected account, with the accounts Studio offers for each.
const FEATURED_ACCOUNTS = new Map<string, FeaturedAccounts>([
  ['goonfi-reference-band', goonfiAccounts('market')],
  ['goonfi-price', goonfiAccounts('oracle')],
  ['goonfi-freshness', goonfiAccounts('oracle')],
  ['goonfi-vault-balance', goonfiAccounts('vault')],
]);

export const getFeaturedAccounts = (templateId: unknown) =>
  typeof templateId === 'string' ? FEATURED_ACCOUNTS.get(templateId) : undefined;

// A featured-account template saves the picked account; any other template keeps its own address.
export const resolveFeaturedAccount = (templateId: unknown, templateAddress: unknown, selectedPubkey: string) => {
  if (!getFeaturedAccounts(templateId)) return templateAddress;
  const pubkey = selectedPubkey.trim();
  return pubkey ? { pubkey } : undefined;
};

const getGoonFiAiContext = () =>
  [
    'Featured GoonFi accounts available in Studio:',
    ...GOONFI_FEATURED_MARKETS.map(
      (market) =>
        `- ${market.label}: market ${market.market}; oracle ${market.oracle}; ` +
        `${market.baseSymbol} vault ${market.baseVault}; ` +
        `${market.quoteSymbol} vault ${market.quoteVault}.`
    ),
  ].join('\n');

const PROTOCOL_AI_CONTEXT: Partial<Record<string, () => string>> = {
  goonfi: getGoonFiAiContext,
};

export const getProtocolAiContext = (protocolId: string): string | undefined => PROTOCOL_AI_CONTEXT[protocolId]?.();
