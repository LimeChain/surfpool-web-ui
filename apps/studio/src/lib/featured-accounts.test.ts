import { describe, expect, it } from 'vitest';
import {
  featuredAccountInputs,
  getFeaturedAccounts,
  getProtocolAiContext,
  resolveFeaturedAccount,
} from './featured-accounts';
import { TESSERA_FEATURED_MARKETS } from './tessera-markets';

const [sol] = TESSERA_FEATURED_MARKETS;
const values = (templateId: string) => getFeaturedAccounts(templateId)?.options.map((option) => option.value);

describe('getFeaturedAccounts', () => {
  it('offers every Tessera template the featured markets it writes', () => {
    for (const templateId of ['tessera-price', 'tessera-depth', 'tessera-curve', 'tessera-halt']) {
      expect(values(templateId)).toEqual(TESSERA_FEATURED_MARKETS.map((market) => market.market));
    }
    expect(getFeaturedAccounts('kamino-reserve-config')).toBeUndefined();
    expect(getFeaturedAccounts('constructor')).toBeUndefined();
  });

  it("saves the picked account for a featured template and keeps other templates' addresses", () => {
    const pda = { pda: { programId: 'program', seeds: [] } };
    expect(resolveFeaturedAccount('tessera-price', { pubkey: '' }, ` ${sol.market} `)).toEqual({ pubkey: sol.market });
    expect(resolveFeaturedAccount('tessera-price', { pubkey: '' }, '   ')).toBeUndefined();
    expect(resolveFeaturedAccount('kamino-reserve-config', pda, '')).toBe(pda);
  });
});

describe('featuredAccountInputs', () => {
  it('fills nothing, since a Tessera market keeps itself alive', () => {
    expect(featuredAccountInputs('tessera-depth', sol.market)).toEqual({});
  });
});

describe('getProtocolAiContext', () => {
  it("returns a registered protocol's context and nothing for any other protocol", () => {
    expect(getProtocolAiContext('tessera')).toContain(sol.market);
    expect(getProtocolAiContext('kamino')).toBeUndefined();
  });
});
