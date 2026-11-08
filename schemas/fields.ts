import * as z from 'zod';

/**
 * Reusable field builders. They accept both HTML form strings and JSON values,
 * so the same schema validates a server action's FormData and an API body.
 *
 * Conventions:
 *  - Blank input ("" or whitespace) on an optional field becomes `null`, which
 *    clears the column on update. A missing key stays `undefined` ("leave as is").
 *  - Blank input on a required field becomes `undefined`, so the "Enter …"
 *    message shows instead of a type error.
 */

const isBlank = (v: unknown) => typeof v === 'string' && v.trim() === '';
const trimIfString = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
const blankTo = (fallback: null | undefined) => (v: unknown) => (isBlank(v) ? fallback : trimIfString(v));

/** Strips thousands separators, spaces and currency symbols: "₦25,000,000" → "25000000". */
const cleanNumeric = (v: unknown) => (typeof v === 'string' ? v.replace(/[₦$£€,\s]/g, '') : v);

const toNumber = (v: unknown) => {
  if (isBlank(v)) return null;
  const cleaned = cleanNumeric(v);
  return typeof cleaned === 'string' ? Number(cleaned) : cleaned;
};

// ── Text ────────────────────────────────────────────────────────────────────

export const requiredText = (label: string, { min = 1, max }: { min?: number; max: number }) =>
  z.preprocess(
    blankTo(undefined),
    z
      .string({ error: `Enter ${label}` })
      .min(min, { error: `Use at least ${min} characters` })
      .max(max, { error: `Use ${max} characters or fewer` }),
  );

export const optionalText = (max: number) =>
  z.preprocess(blankTo(null), z.string().max(max, { error: `Use ${max} characters or fewer` }).nullish());

// ── Numbers ─────────────────────────────────────────────────────────────────

/**
 * Money stays a string so it reaches Prisma's Decimal column without float
 * rounding. Fits DECIMAL(15,2): up to 13 whole digits and 2 decimals.
 */
export const optionalMoney = () =>
  z.preprocess(
    (v) => {
      if (isBlank(v)) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'invalid';
      return cleanNumeric(v);
    },
    z
      .string()
      .regex(/^\d{1,13}(\.\d{1,2})?$/, { error: 'Enter an amount in numbers, e.g. 25000000' })
      .nullish(),
  );

export const optionalPositiveNumber = (max: number, label = 'a number') =>
  z.preprocess(
    toNumber,
    z
      .number({ error: `Enter ${label}` })
      .positive({ error: 'Must be more than 0' })
      .max(max, { error: `Must be ${max.toLocaleString('en-NG')} or less` })
      .nullish(),
  );

export const optionalInt = (min: number, max: number) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: 'Enter a whole number' })
      .int({ error: 'Enter a whole number' })
      .min(min, { error: min === 0 ? "Can't be negative" : `Must be ${min} or more` })
      .max(max, { error: `Must be ${max} or less` })
      .nullish(),
  );

/** Room counts and similar: whole numbers from 0. */
export const optionalCount = (max: number) => optionalInt(0, max);

export const optionalCoordinate = (limit: 90 | 180) =>
  z.preprocess(
    toNumber,
    z
      .number({ error: 'Enter a number' })
      .min(-limit, { error: `Must be between -${limit} and ${limit}` })
      .max(limit, { error: `Must be between -${limit} and ${limit}` })
      .transform((n) => Math.round(n * 1e6) / 1e6) // DECIMAL(9,6)
      .nullish(),
  );

// ── Choices ─────────────────────────────────────────────────────────────────

type EnumLike = Readonly<Record<string, string>>;

/** Takes a Prisma enum object directly, so the allowed values never drift from the DB. */
export const requiredEnum = <T extends EnumLike>(values: T, label: string) =>
  z.preprocess(blankTo(undefined), z.enum(values, { error: `Choose ${label}` }));

export const optionalEnum = <T extends EnumLike>(values: T, label: string) =>
  z.preprocess(blankTo(null), z.enum(values, { error: `Choose ${label}` }).nullish());

/**
 * Checkbox / boolean. "on" and "true" mean true; "off" and "false" mean false;
 * a missing key stays undefined.
 *
 * Unchecked HTML checkboxes send nothing at all, so for a field whose default is
 * true, put a hidden input BEFORE the checkbox:
 *   <input type="hidden" name="showExactAddress" value="false" />
 *   <input type="checkbox" name="showExactAddress" defaultChecked />
 * formDataToObject() keeps the last value, so checked → "on", unchecked → "false".
 */
export const checkbox = () =>
  z.preprocess((v) => {
    if (v === true || v === 'on' || v === 'true') return true;
    if (v === false || v === 'off' || v === 'false') return false;
    return v;
  }, z.boolean({ error: 'Choose yes or no' }).optional());

// ── Identifiers ─────────────────────────────────────────────────────────────

export const uuid = (label = 'id') => z.uuid({ error: `Invalid ${label}` });

export const slug = () =>
  z.preprocess(
    blankTo(undefined),
    z
      .string()
      .max(200, { error: 'Use 200 characters or fewer' })
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'Use lowercase letters, numbers and single hyphens only' })
      .optional(),
  );

/** "3-Bedroom Duplex, Lekki Phase 1!" → "3-bedroom-duplex-lekki-phase-1" */
export function slugify(input: string, maxLength = 200) {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** URL search params can repeat (?a=1&a=2); take the first and treat blanks as absent. */
export const firstParam = (v: unknown) => {
  const first = Array.isArray(v) ? v[0] : v;
  return isBlank(first) ? undefined : trimIfString(first);
};
