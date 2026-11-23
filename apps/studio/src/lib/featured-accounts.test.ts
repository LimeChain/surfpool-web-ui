import { describe, expect, it } from 'vitest';
import {
  featuredAccountInputs,
  getFeaturedAccounts,
  getProtocolAiContext,
  resolveFeaturedAccount,
} from './featured-accounts';
import { BISONFI_FEATURED_MARKETS } from './pmms/bisonfi';
import { TESSERA_FEATURED_MARKETS } from './pmms/tessera';

const [sol] = TESSERA_FEATURED_MARKETS;
const [bisonSol] = BISONFI_FEATURED_MARKETS;
const values = (templateId: string) => getFeaturedAccounts(templateId)?.options.map((option) => option.value);

describe('getFeaturedAccounts', () => {
  it('offers every Tessera template the featured markets it writes', () => {
    for (const templateId of ['tessera-price', 'tessera-depth', 'tessera-curve', 'tessera-halt']) {
      expect(values(templateId)).toEqual(TESSERA_FEATURED_MARKETS.map((market) => market.market));
    }
    expect(getFeaturedAccounts('kamino-reserve-config')).toBeUndefined();
    expect(getFeaturedAccounts('constructor')).toBeUndefined();
  });

  it('offers every BisonFi template the featured pools it writes', () => {
    for (const templateId of ['bisonfi-fair-value', 'bisonfi-depth', 'bisonfi-spread']) {
      expect(values(templateId)).toEqual(BISONFI_FEATURED_MARKETS.map((market) => market.market));
    }
    expect(new Set(values('bisonfi-fair-value')).size).toBe(BISONFI_FEATURED_MARKETS.length);
  });

  it("saves the picked account for a featured template and keeps other templates' addresses", () => {
    const pda = { pda: { programId: 'program', seeds: [] } };
    expect(resolveFeaturedAccount('tessera-price', { pubkey: '' }, ` ${sol.market} `)).toEqual({ pubkey: sol.market });
    expect(resolveFeaturedAccount('tessera-price', { pubkey: '' }, '   ')).toBeUndefined();
    expect(resolveFeaturedAccount('bisonfi-spread', { pubkey: '' }, ` ${bisonSol.market} `)).toEqual({
      pubkey: bisonSol.market,
    });
    expect(resolveFeaturedAccount('bisonfi-depth', { pubkey: '' }, '   ')).toBeUndefined();
    expect(resolveFeaturedAccount('kamino-reserve-config', pda, '')).toBe(pda);
  });
});

describe('featuredAccountInputs', () => {
  it('fills nothing, since a Tessera market keeps itself alive', () => {
    expect(featuredAccountInputs('tessera-depth', sol.market)).toEqual({});
  });

  it('fills nothing, since a BisonFi pool keeps itself alive', () => {
    expect(featuredAccountInputs('bisonfi-depth', bisonSol.market)).toEqual({});
  });
});

describe('getProtocolAiContext', () => {
  it("returns a registered protocol's context and nothing for any other protocol", () => {
    expect(getProtocolAiContext('tessera')).toContain(sol.market);
    expect(getProtocolAiContext('bisonfi')).toContain(bisonSol.market);
    expect(getProtocolAiContext('kamino')).toBeUndefined();
  });
});
