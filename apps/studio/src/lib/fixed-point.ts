const FIXED_POINT_TYPE = /([IU])(\d+)F(\d+)$/;
const DECIMAL = /^(-)?(\d*)(?:\.(\d*))?$/;

export type FixedPointFormat = { name: string; signed: boolean; fractionBits: number; bytes: number };

const definedName = (type: any): string | undefined =>
  typeof type?.defined === 'string' ? type.defined : type?.defined?.name;

/**
 * The format of a fixed-point number the IDL stores as `[u8; N]` in a struct named after it, such as
 * `WrappedI80F48.value`: signed, 80 whole bits and 48 fraction bits. Null for any other field.
 */
export function fixedPointFormat(idl: any, accountType: string | undefined, path: string): FixedPointFormat | null {
  let type: any = { defined: accountType };
  let owner = '';
  for (const segment of path.split('.')) {
    if (type?.array || type?.vec) {
      type = type.array?.[0] ?? type.vec;
      continue;
    }
    owner = definedName(type) ?? '';
    const struct = idl?.types?.find((typeDef: any) => typeDef.name === owner);
    type = struct?.type?.fields?.find((field: any) => field.name === segment)?.type;
    if (type === undefined) return null;
  }
  const match = FIXED_POINT_TYPE.exec(owner);
  const [element, length] = Array.isArray(type?.array) ? type.array : [];
  if (!match || element !== 'u8' || Number(match[2]) + Number(match[3]) !== length * 8) return null;
  return { name: match[0], signed: match[1] === 'I', fractionBits: Number(match[3]), bytes: length };
}

/**
 * The little-endian bytes of a decimal, rounded to the nearest step of 2^-fractionBits with halves away from
 * zero. Null when the text is not a plain decimal or the value does not fit.
 */
export function decimalToFixedPoint(text: string, format: FixedPointFormat): number[] | null {
  const match = DECIMAL.exec(text.trim());
  if (!match || !(match[2] || match[3])) return null;
  const [, minus, whole = '', fraction = ''] = match;
  const scale = BigInt(10) ** BigInt(fraction.length);
  const magnitude = ((BigInt(whole + fraction) << BigInt(format.fractionBits + 1)) + scale) / (BigInt(2) * scale);
  const raw = minus ? -magnitude : magnitude;
  const bits = BigInt(format.bytes * 8);
  const limit = BigInt(1) << (format.signed ? bits - BigInt(1) : bits);
  if (raw >= limit || raw < (format.signed ? -limit : BigInt(0))) return null;
  const unsigned = raw < BigInt(0) ? raw + (BigInt(1) << bits) : raw;
  return Array.from({ length: format.bytes }, (_, i) => Number((unsigned >> BigInt(8 * i)) & BigInt(255)));
}

/** The shortest decimal that converts back to exactly these bytes, or null when they are not the format's bytes. */
export function fixedPointToDecimal(bytes: unknown, format: FixedPointFormat): string | null {
  if (!Array.isArray(bytes) || bytes.length !== format.bytes) return null;
  if (!bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte < 256)) return null;
  let raw = bytes.reduceRight((value: bigint, byte: number) => (value << BigInt(8)) | BigInt(byte), BigInt(0));
  if (format.signed && bytes[bytes.length - 1] >= 128) raw -= BigInt(1) << BigInt(format.bytes * 8);
  const sign = raw < BigInt(0) ? '-' : '';
  const magnitude = raw < BigInt(0) ? -raw : raw;
  const one = BigInt(1) << BigInt(format.fractionBits);
  for (let digits = 0; ; digits++) {
    const scaled = ((magnitude * BigInt(10) ** BigInt(digits) * BigInt(2) + one) / (BigInt(2) * one)).toString();
    const padded = scaled.padStart(digits + 1, '0');
    const point = padded.length - digits;
    const text = sign + padded.slice(0, point) + (digits ? `.${padded.slice(point)}` : '');
    if (String(decimalToFixedPoint(text, format)) === String(bytes)) return text;
  }
}

/** create_scenario arguments with each decimal given for a fixed-point field turned into the field's bytes. */
export function withFixedPointBytes(templates: any[], args: Record<string, any>): Record<string, any> {
  if (!Array.isArray(args?.overrides) || !Array.isArray(templates)) return args;
  const overrides = args.overrides.map((override: any) => {
    const template = templates.find((candidate) => candidate?.id === override?.templateId);
    const values = Object.entries(override?.values ?? {}).map(([path, value]) => {
      const format = fixedPointFormat(template?.idl, template?.accountType, path);
      const isDecimal = typeof value === 'string' || typeof value === 'number';
      return [path, (format && isDecimal && decimalToFixedPoint(String(value), format)) || value];
    });
    return override?.values ? { ...override, values: Object.fromEntries(values) } : override;
  });
  return { ...args, overrides };
}
