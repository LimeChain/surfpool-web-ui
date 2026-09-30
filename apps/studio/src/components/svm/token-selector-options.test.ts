import { describe, expect, it } from 'vitest';
import {
  getSolFiCustomAccountKind,
  resolveTokenSelectorOptions,
  shouldUseConstantCombobox,
  type TokenSelectorOption,
} from './token-selector-options';

const catalogOptions: TokenSelectorOption[] = [
  { id: 'catalog-token', label: 'Catalog token', value: 'CatalogMintpump' },
  { id: 'hex-value', label: 'Hex value', value: '0xAbCd' },
];

describe('resolveTokenSelectorOptions', () => {
  it('preserves a custom current value outside the catalog', () => {
    const result = resolveTokenSelectorOptions(catalogOptions, 'CustomMintpump');
    const reselected = resolveTokenSelectorOptions(catalogOptions, result.selectedOption?.value);

    expect(result.selectedOption).toMatchObject({
      id: 'custom-CustomMintpump',
      value: 'CustomMintpump',
    });
    expect(result.options[0]).toBe(result.selectedOption);
    expect(result.options.slice(1)).toEqual(catalogOptions);
    expect(reselected.selectedOption).toEqual(result.selectedOption);
  });

  it('reuses the catalog option for a catalog value', () => {
    const result = resolveTokenSelectorOptions(catalogOptions, 'CatalogMintpump');

    expect(result.selectedOption).toBe(catalogOptions[0]);
    expect(result.options).toBe(catalogOptions);
  });

  it('matches hex values case-insensitively', () => {
    const result = resolveTokenSelectorOptions(catalogOptions, '0xabcd');

    expect(result.selectedOption).toBe(catalogOptions[1]);
    expect(result.options).toBe(catalogOptions);
  });
});

describe('getSolFiCustomAccountKind', () => {
  it('names the concrete account expected by each SolFi template', () => {
    expect(getSolFiCustomAccountKind('SolFi', 'solfi-spread')).toBe('market');
    expect(getSolFiCustomAccountKind('SolFi', 'solfi-size-impact')).toBe('market');
    expect(getSolFiCustomAccountKind('SolFi', 'solfi-price')).toBe('oracle');
    expect(getSolFiCustomAccountKind('SolFi', 'solfi-freshness')).toBe('oracle');
    expect(getSolFiCustomAccountKind('SolFi', 'solfi-vault-balance')).toBe('vault');
  });

  it('does not add a custom-address control to other protocols', () => {
    expect(getSolFiCustomAccountKind('Raydium', 'solfi-spread')).toBeUndefined();
    expect(getSolFiCustomAccountKind('SolFi', 'unknown-template')).toBeUndefined();
  });
});

describe('shouldUseConstantCombobox', () => {
  it('uses the shared searchable protocol selector for account choices of any size', () => {
    expect(shouldUseConstantCombobox(2, true)).toBe(true);
  });

  it('preserves the existing threshold for ordinary constant fields', () => {
    expect(shouldUseConstantCombobox(2, false)).toBe(false);
    expect(shouldUseConstantCombobox(21, false)).toBe(true);
  });
});
