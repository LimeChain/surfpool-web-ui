import { HUMIDIFI_FEATURED_MARKETS } from '@/lib/humidifi-markets';

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

const humidifiAccounts = (kind: 'market' | 'vault'): FeaturedAccounts => ({
  label: `HumidiFi ${kind}`,
  description: 'Pick a featured market or type any HumidiFi account address.',
  options:
    kind === 'vault'
      ? HUMIDIFI_FEATURED_MARKETS.flatMap((market) => [
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
      : HUMIDIFI_FEATURED_MARKETS.map((market) => ({
          id: market.id,
          label: market.label,
          value: market.market,
          description: 'Market account',
        })),
});

// Templates that write a caller-selected account, with the accounts Studio offers for each.
const FEATURED_ACCOUNTS = new Map<string, FeaturedAccounts>([
  ['humidifi-price', humidifiAccounts('market')],
  ['humidifi-freshness', humidifiAccounts('market')],
  ['humidifi-spread', humidifiAccounts('market')],
  ['humidifi-vault-balance', humidifiAccounts('vault')],
]);

export const getFeaturedAccounts = (templateId: unknown) =>
  typeof templateId === 'string' ? FEATURED_ACCOUNTS.get(templateId) : undefined;

// A featured-account template saves the picked account; any other template keeps its own address.
export const resolveFeaturedAccount = (templateId: unknown, templateAddress: unknown, selectedPubkey: string) => {
  if (!getFeaturedAccounts(templateId)) return templateAddress;
  const pubkey = selectedPubkey.trim();
  return pubkey ? { pubkey } : undefined;
};

const getHumidiFiAiContext = () =>
  [
    'Featured HumidiFi accounts available in Studio:',
    ...HUMIDIFI_FEATURED_MARKETS.map(
      (market) =>
        `- ${market.label}: market ${market.market}; ` +
        `${market.baseSymbol} vault ${market.baseVault}; ` +
        `${market.quoteSymbol} vault ${market.quoteVault}.`
    ),
  ].join('\n');

const PROTOCOL_AI_CONTEXT: Partial<Record<string, () => string>> = {
  humidifi: getHumidiFiAiContext,
};

export const getProtocolAiContext = (protocolId: string): string | undefined => PROTOCOL_AI_CONTEXT[protocolId]?.();
