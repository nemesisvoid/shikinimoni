import * as z from 'zod';

/**
 * FormData → plain object for Zod.
 *  - Single fields keep their LAST value (makes the hidden-input checkbox pattern work).
 *  - Fields listed in `arrayFields` keep every value (e.g. a group of amenity checkboxes).
 *  - Next.js's internal `$ACTION_…` fields and File entries are dropped; files are
 *    uploaded straight to storage, not through the action.
 */
export function formDataToObject(formData: FormData, arrayFields: readonly string[] = []) {
  const result: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith('$ACTION')) continue;
    const values = formData.getAll(key).filter((v): v is string => typeof v === 'string');
    result[key] = arrayFields.includes(key) ? values : values.at(-1);
  }
  return result;
}

export type FieldErrors = Record<string, string[] | undefined>;

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: FieldErrors; formErrors: string[] };

/**
 * Validate a server action's FormData. Returns field-level messages ready to
 * send back through useActionState instead of throwing.
 */
export function parseFormData<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  options: { arrayFields?: readonly string[] } = {},
): ParseResult<z.output<S>> {
  return toParseResult(schema.safeParse(formDataToObject(formData, options.arrayFields)));
}

/** Same result shape for JSON bodies (API routes) or already-built objects. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>> {
  return toParseResult(schema.safeParse(input));
}

function toParseResult<T>(result: z.ZodSafeParseResult<T>): ParseResult<T> {
  if (result.success) return { success: true, data: result.data };
  const { fieldErrors, formErrors } = z.flattenError(result.error);
  return { success: false, fieldErrors: fieldErrors as FieldErrors, formErrors };
}
