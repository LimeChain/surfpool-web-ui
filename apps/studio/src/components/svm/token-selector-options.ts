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
export const typedAccountOption = (query: string, options: TokenSelectorOption[]): TokenSelectorOption | null =>
  isAccountAddress(query) && !options.some((option) => option.value === query)
    ? { id: `custom-${query}`, label: 'Custom address', value: query, metadata: { symbol: `Custom · ${query}` } }
    : null;
