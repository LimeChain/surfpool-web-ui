import { describe, expect, it } from 'vitest';
import { decimalToFixedPoint, fixedPointFormat, fixedPointToDecimal, withFixedPointBytes } from './fixed-point';

const I80F48 = { name: 'I80F48', signed: true, fractionBits: 48, bytes: 16 };
const ZERO = Array(16).fill(0);
const ONE = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const POINT_85 = [154, 153, 153, 153, 153, 217, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const MINUS_POINT_85 = [102, 102, 102, 102, 102, 38, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255];
const MAX = [...Array(15).fill(255), 127];
const MIN = [...Array(15).fill(0), 128];

const idl = {
  types: [
    {
      name: 'Bank',
      type: {
        kind: 'struct',
        fields: [
          { name: 'config', type: { defined: { name: 'BankConfig' } } },
          { name: 'balances', type: { array: [{ defined: { name: 'Balance' } }, 16] } },
          { name: 'padding', type: { array: ['u8', 16] } },
        ],
      },
    },
    {
      name: 'BankConfig',
      type: { kind: 'struct', fields: [{ name: 'asset_weight_init', type: { defined: { name: 'WrappedI80F48' } } }] },
    },
    {
      name: 'Balance',
      type: { kind: 'struct', fields: [{ name: 'asset_shares', type: { defined: { name: 'WrappedI80F48' } } }] },
    },
    { name: 'WrappedI80F48', type: { kind: 'struct', fields: [{ name: 'value', type: { array: ['u8', 16] } }] } },
  ],
};

describe('fixedPointFormat', () => {
  it('reads the format from the name of the struct that holds the bytes, through arrays', () => {
    expect(fixedPointFormat(idl, 'Bank', 'config.asset_weight_init.value')).toEqual(I80F48);
    expect(fixedPointFormat(idl, 'Bank', 'balances.3.asset_shares.value')).toEqual(I80F48);
  });

  it('leaves out other byte arrays, the wrapping struct and unknown paths', () => {
    expect(fixedPointFormat(idl, 'Bank', 'padding')).toBeNull();
    expect(fixedPointFormat(idl, 'Bank', 'config.asset_weight_init')).toBeNull();
    expect(fixedPointFormat(idl, 'Bank', 'config.missing.value')).toBeNull();
    expect(fixedPointFormat(undefined, 'Bank', 'config.asset_weight_init.value')).toBeNull();
  });
});

describe('decimalToFixedPoint', () => {
  it.each([
    ['0', ZERO],
    ['1', ONE],
    ['0.85', POINT_85],
    ['.85', POINT_85],
    [' 0.850 ', POINT_85],
    ['-0.85', MINUS_POINT_85],
    ['-1', [0, 0, 0, 0, 0, 0, ...Array(10).fill(255)]],
    ['-604462909807314587353088', MIN],
  ])('encodes %s', (text, bytes) => {
    expect(decimalToFixedPoint(text, I80F48)).toEqual(bytes);
  });

  it('rounds a long fraction to the nearest step, halves away from zero', () => {
    expect(decimalToFixedPoint('0.123456789012345678901234567890', I80F48)).toEqual([
      246, 70, 55, 221, 154, 31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const halfStep = '0.0000000000000017763568394002504646778106689453125';
    expect(decimalToFixedPoint(halfStep, I80F48)).toEqual([1, ...Array(15).fill(0)]);
    expect(decimalToFixedPoint(`-${halfStep}`, I80F48)).toEqual(Array(16).fill(255));
  });

  it('refuses text that is not a plain decimal or a value that does not fit', () => {
    for (const text of ['', '.', '-', 'abc', '1e3', '0x10', '1,5', '1.2.3']) {
      expect(decimalToFixedPoint(text, I80F48)).toBeNull();
    }
    expect(decimalToFixedPoint('604462909807314587353088', I80F48)).toBeNull();
    expect(decimalToFixedPoint('-604462909807314587353088.000000000000004', I80F48)).toBeNull();
    expect(decimalToFixedPoint('-1', { ...I80F48, signed: false })).toBeNull();
  });
});

describe('fixedPointToDecimal', () => {
  it.each([
    [ZERO, '0'],
    [ONE, '1'],
    [POINT_85, '0.85'],
    [MINUS_POINT_85, '-0.85'],
    [MAX, '604462909807314587353087.999999999999996'],
    [MIN, '-604462909807314587353088'],
  ])('shows %j as %s', (bytes, text) => {
    expect(fixedPointToDecimal(bytes, I80F48)).toBe(text);
  });

  it('shows the shortest decimal a rounded long fraction comes back from', () => {
    const bytes = decimalToFixedPoint('0.123456789012345678901234567890', I80F48);
    expect(fixedPointToDecimal(bytes, I80F48)).toBe('0.123456789012344');
  });

  it('round-trips any 16 bytes through the decimal it shows', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const bytes = Array.from({ length: 16 }, (_, i) => (seed * 37 + i * 101 + ((seed * i) % 7)) % 256);
      expect(decimalToFixedPoint(fixedPointToDecimal(bytes, I80F48)!, I80F48)).toEqual(bytes);
    }
  });

  it('shows nothing for a value that is not the format bytes', () => {
    expect(fixedPointToDecimal('0.85', I80F48)).toBeNull();
    expect(fixedPointToDecimal([1, 2, 3], I80F48)).toBeNull();
    expect(fixedPointToDecimal([...ZERO.slice(1), 256], I80F48)).toBeNull();
  });
});

describe('withFixedPointBytes', () => {
  const templates = [{ id: 'weights', accountType: 'Bank', idl }];

  it('turns a decimal for a fixed-point field into its bytes and keeps every other value', () => {
    const args = {
      name: 'Weights',
      overrides: [
        {
          templateId: 'weights',
          values: { 'config.asset_weight_init.value': '0.85', 'balances.0.asset_shares.value': 1, padding: '7' },
        },
        { templateId: 'weights', values: { 'config.asset_weight_init.value': ONE } },
        { templateId: 'unknown', values: { 'config.asset_weight_init.value': '0.85' } },
      ],
    };
    expect(withFixedPointBytes(templates, args)).toEqual({
      name: 'Weights',
      overrides: [
        {
          templateId: 'weights',
          values: { 'config.asset_weight_init.value': POINT_85, 'balances.0.asset_shares.value': ONE, padding: '7' },
        },
        { templateId: 'weights', values: { 'config.asset_weight_init.value': ONE } },
        { templateId: 'unknown', values: { 'config.asset_weight_init.value': '0.85' } },
      ],
    });
  });

  it('passes a decimal it cannot convert, and arguments without overrides, through unchanged', () => {
    const args = { overrides: [{ templateId: 'weights', values: { 'config.asset_weight_init.value': 'abc' } }] };
    expect(withFixedPointBytes(templates, args)).toEqual(args);
    expect(withFixedPointBytes(templates, { id: 'x' })).toEqual({ id: 'x' });
  });
});
