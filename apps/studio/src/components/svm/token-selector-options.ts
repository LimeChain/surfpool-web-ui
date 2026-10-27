import { PROJECT0_FEATURED_BANKS } from '@/lib/project0-banks';

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
  const customOption = !catalogOption && currentValueString ? customValueOption(currentValueString) : null;

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

const project0Banks: FeaturedAccounts = {
  label: 'Project 0 bank',
  description: 'Pick a featured bank or type any Project 0 bank address.',
  options: PROJECT0_FEATURED_BANKS.map((bank) => ({
    id: bank.id,
    label: `${bank.label} bank`,
    value: bank.bank,
    description: 'Native bank of the main group',
  })),
};

const project0PriceAccounts: FeaturedAccounts = {
  label: 'Pyth Pro-compatible price account',
  description: "Pick a featured bank's price account or type any Pyth Pro-compatible price account.",
  options: PROJECT0_FEATURED_BANKS.map((bank) => ({
    id: bank.id,
    label: `${bank.label} / USD`,
    value: bank.priceAccount,
    description: `Price account the ${bank.label} bank reads`,
  })),
};

const project0Accounts: FeaturedAccounts = {
  label: 'Project 0 account',
  description: 'Type the MarginfiAccount address.',
  options: [],
};

// Templates that write a caller-selected account, with the accounts Studio offers for each.
const FEATURED_ACCOUNTS = new Map<string, FeaturedAccounts>([
  ['project0-bank-risk-weights', project0Banks],
  ['project0-bank-limits', project0Banks],
  ['project0-bank-status', project0Banks],
  ['project0-bank-oracle', project0Banks],
  ['project0-bank-interest-rate', project0Banks],
  ['project0-bank-shares', project0Banks],
  ['project0-account-balance', project0Accounts],
  ['project0-account-authority', project0Accounts],
  ['pyth-pro-price-feed-v2', project0PriceAccounts],
]);

export const getFeaturedAccounts = (templateId: unknown) =>
  typeof templateId === 'string' ? FEATURED_ACCOUNTS.get(templateId) : undefined;

// A featured-account template saves the picked account; any other template keeps its own address.
export const resolveFeaturedAccount = (templateId: unknown, templateAddress: unknown, selectedPubkey: string) => {
  if (!getFeaturedAccounts(templateId)) return templateAddress;
  const pubkey = selectedPubkey.trim();
  return pubkey ? { pubkey } : undefined;
};

const getProject0AiContext = () =>
  [
    'Featured Project 0 accounts available in Studio:',
    ...PROJECT0_FEATURED_BANKS.map((bank) => `- ${bank.label}: bank ${bank.bank}; price account ${bank.priceAccount}.`),
    'A bank refuses a price that moved past its circuit breaker: before moving a price, read the project0-bank-oracle template and follow it.',
  ].join('\n');

const PROTOCOL_AI_CONTEXT: Partial<Record<string, () => string>> = {
  'project-0': getProject0AiContext,
};

export const getProtocolAiContext = (protocolId: string): string | undefined => PROTOCOL_AI_CONTEXT[protocolId]?.();
