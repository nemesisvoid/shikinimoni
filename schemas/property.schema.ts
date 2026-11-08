import * as z from 'zod';
import {
  Availability,
  Furnishing,
  ListingStatus,
  ListingType,
  PricePeriod,
  PropertyCategory,
  PropertyType,
  SizeUnit,
} from '@/lib/generated/prisma/enums';
import {
  checkbox,
  firstParam,
  optionalCoordinate,
  optionalCount,
  optionalEnum,
  optionalInt,
  optionalMoney,
  optionalPositiveNumber,
  optionalText,
  requiredEnum,
  requiredText,
  slug,
  slugify,
  uuid,
} from './fields';

// ─────────────────────────────────────────────────────────────────────────────
// Reference data (also useful for building the form UI)
// ─────────────────────────────────────────────────────────────────────────────

const BUILDING_TYPES = [
  'APARTMENT',
  'BUNGALOW',
  'DUPLEX',
  'SEMI_DETACHED_DUPLEX',
  'TERRACE',
  'DETACHED_HOUSE',
  'PENTHOUSE',
  'MAISONETTE',
  'STUDIO',
] as const satisfies readonly PropertyType[];
const COMMERCIAL_TYPES = ['OFFICE', 'SHOP', 'WAREHOUSE', 'HOTEL', 'EVENT_CENTRE', 'FILLING_STATION'] as const satisfies readonly PropertyType[];

/** Which property types make sense in each category. Use it to filter the "type" dropdown. */
export const PROPERTY_TYPES_BY_CATEGORY: Record<PropertyCategory, readonly PropertyType[]> = {
  RESIDENTIAL: [...BUILDING_TYPES, 'OTHER'],
  COMMERCIAL: [...COMMERCIAL_TYPES, 'OTHER'],
  LAND: ['RESIDENTIAL_LAND', 'COMMERCIAL_LAND', 'FARMLAND'],
  INDUSTRIAL: ['WAREHOUSE', 'OTHER'],
  AGRICULTURAL: ['FARMLAND', 'OTHER'],
  MIXED_USE: [...BUILDING_TYPES, ...COMMERCIAL_TYPES, 'OTHER'],
};

/**
 * Square metres per unit, used to fill `landAreaSqm` (the filter/sort column)
 * when the admin doesn't enter it. A "plot" isn't a fixed size: 648 sqm is the
 * common 60 × 120 ft plot, but many estates sell 450–600 sqm plots, so admins
 * should enter landAreaSqm whenever the plot size is known.
 */
export const DEFAULT_PLOT_SQM = 648;
export const SQM_PER_UNIT: Record<SizeUnit, number> = {
  SQM: 1,
  SQFT: 0.09290304,
  PLOT: DEFAULT_PLOT_SQM,
  ACRE: 4046.8564224,
  HECTARE: 10_000,
};

/** FormData fields that carry several values (checkbox groups). Pass to parseFormData(). */
export const PROPERTY_FORM_ARRAY_FIELDS = ['amenityIds'] as const;

const MAX_YEAR_BUILT = new Date().getFullYear() + 5; // allows off-plan

// ─────────────────────────────────────────────────────────────────────────────
// Fields (no defaults here; see CreatePropertySchema for why)
// ─────────────────────────────────────────────────────────────────────────────

const upperCode = (length: 2 | 3, label: string, example: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() || undefined : v),
    z
      .string({ error: `Choose ${label}` })
      .regex(new RegExp(`^[A-Z]{${length}}$`), { error: `Use a ${length}-letter code, e.g. ${example}` }),
  );

const amenityIds = () =>
  z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      const list = Array.isArray(v) ? v : [v];
      return list.filter((x) => x !== '' && x !== null).map((x) => (typeof x === 'string' ? Number(x) : x));
    },
    z
      .array(z.number({ error: 'Invalid amenity' }).int({ error: 'Invalid amenity' }).positive({ error: 'Invalid amenity' }))
      .max(50, { error: 'Choose 50 amenities or fewer' })
      .transform((ids) => [...new Set(ids)])
      .optional(),
  );

const propertyFields = z.object({
  // Basics
  name: requiredText('a property name', { min: 3, max: 200 }),
  slug: slug(),
  summary: optionalText(500),
  description: requiredText('a description', { min: 20, max: 20_000 }),
  category: requiredEnum(PropertyCategory, 'a category'),
  type: requiredEnum(PropertyType, 'a property type'),
  listingType: requiredEnum(ListingType, 'a listing type'),
  status: requiredEnum(ListingStatus, 'a status'),
  availability: requiredEnum(Availability, 'availability'),
  isFeatured: checkbox(),

  // Pricing (price empty = "price on request")
  price: optionalMoney(),
  currency: upperCode(3, 'a currency', 'NGN'),
  pricePeriod: requiredEnum(PricePeriod, 'how the price is charged'),
  isNegotiable: checkbox(),
  serviceCharge: optionalMoney(),

  // Size
  landSize: optionalPositiveNumber(99_999_999, 'a land size'),
  landSizeUnit: optionalEnum(SizeUnit, 'a unit'),
  landAreaSqm: optionalPositiveNumber(999_999_999_999, 'an area in sqm'),
  floorAreaSqm: optionalPositiveNumber(9_999_999_999, 'a floor area in sqm'),

  // Layout
  bedrooms: optionalCount(50),
  bathrooms: optionalCount(50),
  toilets: optionalCount(50),
  parkingSpaces: optionalCount(500),
  floors: optionalCount(200),
  yearBuilt: optionalInt(1800, MAX_YEAR_BUILT),
  furnishing: optionalEnum(Furnishing, 'a furnishing option'),
  titleType: optionalText(120),

  // Location
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  neighborhood: optionalText(120),
  city: requiredText('a city or town', { max: 120 }),
  state: requiredText('a state', { max: 120 }),
  country: upperCode(2, 'a country', 'NG'),
  postalCode: optionalText(20),
  latitude: optionalCoordinate(90),
  longitude: optionalCoordinate(180),
  showExactAddress: checkbox(),

  // Relations
  amenityIds: amenityIds(),
});

type PropertyFields = z.output<typeof propertyFields>;

// ─────────────────────────────────────────────────────────────────────────────
// Cross-field rules. These mirror the database CHECK constraints, so users get a
// field message instead of a database error. On updates, a rule only runs when
// every field it needs was sent (the DB constraints still guard the rest).
// ─────────────────────────────────────────────────────────────────────────────

function propertyRules(mode: 'create' | 'update') {
  return (data: Partial<PropertyFields>, ctx: z.RefinementCtx) => {
    const sent = (...keys: (keyof PropertyFields)[]) => mode === 'create' || keys.every((k) => data[k] !== undefined);
    const issue = (path: keyof PropertyFields, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const isEmpty = (v: unknown) => v === null || v === undefined;

    if (sent('category', 'type') && data.category && data.type) {
      if (!PROPERTY_TYPES_BY_CATEGORY[data.category].includes(data.type)) {
        issue('type', "That property type doesn't fit the chosen category");
      }
    }

    if (sent('listingType', 'pricePeriod') && data.listingType && data.pricePeriod) {
      if (data.listingType === 'SALE' && data.pricePeriod !== 'TOTAL') {
        issue('pricePeriod', 'Sale prices are a one-off total');
      }
      if (data.listingType !== 'SALE' && data.pricePeriod === 'TOTAL') {
        issue('pricePeriod', 'Choose how often rent is paid, e.g. per year');
      }
    }

    if (sent('landSize', 'landSizeUnit') && isEmpty(data.landSize) !== isEmpty(data.landSizeUnit)) {
      if (isEmpty(data.landSize)) issue('landSize', 'Enter the land size for this unit');
      else issue('landSizeUnit', 'Choose a unit for the land size');
    }

    if (sent('latitude', 'longitude') && isEmpty(data.latitude) !== isEmpty(data.longitude)) {
      issue(isEmpty(data.latitude) ? 'latitude' : 'longitude', 'Enter both latitude and longitude, or neither');
    }

    if (data.category === 'LAND') {
      if (mode === 'create' && isEmpty(data.landSize)) issue('landSize', 'Enter the land size');
      for (const field of ['bedrooms', 'bathrooms', 'toilets', 'floors', 'furnishing'] as const) {
        if (!isEmpty(data[field])) issue(field, 'Leave this empty for land');
      }
    }
  };
}

/** Fills landAreaSqm from landSize + unit when it wasn't entered. */
function withLandArea<T extends Partial<PropertyFields>>(data: T): T {
  if (data.landAreaSqm == null && data.landSize != null && data.landSizeUnit != null) {
    const sqm = Math.round(data.landSize * SQM_PER_UNIT[data.landSizeUnit] * 100) / 100;
    return { ...data, landAreaSqm: sqm };
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / update
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Defaults live only here. If the shared fields had defaults, a partial update
 * that omitted `status` would quietly reset a published listing to DRAFT.
 * Slug: generated from the name when left blank; the service must still handle
 * a unique-constraint clash (e.g. append "-2").
 */
export const CreatePropertySchema = propertyFields
  .extend({
    status: propertyFields.shape.status.default('DRAFT'),
    availability: propertyFields.shape.availability.default('AVAILABLE'),
    isFeatured: propertyFields.shape.isFeatured.default(false),
    currency: propertyFields.shape.currency.default('NGN'),
    pricePeriod: propertyFields.shape.pricePeriod.default('TOTAL'),
    isNegotiable: propertyFields.shape.isNegotiable.default(false),
    country: propertyFields.shape.country.default('NG'),
    showExactAddress: propertyFields.shape.showExactAddress.default(true),
    amenityIds: propertyFields.shape.amenityIds.default([]),
  })
  .superRefine(propertyRules('create'))
  .transform((data) => withLandArea({ ...data, slug: data.slug ?? slugify(data.name) }));

/**
 * Edit form (all fields sent) or partial update (only changed fields sent).
 * Missing keys are left unchanged; blank optional fields become null (cleared).
 */
export const UpdatePropertySchema = propertyFields
  .partial()
  .extend({ id: uuid('property id') })
  .superRefine(propertyRules('update'))
  .refine((data) => Object.entries(data).some(([key, value]) => key !== 'id' && value !== undefined), {
    error: 'There are no changes to save',
  })
  .transform(withLandArea);

// ─────────────────────────────────────────────────────────────────────────────
// Single-purpose admin actions
// ─────────────────────────────────────────────────────────────────────────────

export const PropertyIdSchema = z.object({ id: uuid('property id') });

/** Quick toggles from the admin table: publish/archive, mark sold, feature. */
export const UpdatePropertyStatusSchema = z
  .object({
    id: uuid('property id'),
    status: requiredEnum(ListingStatus, 'a status').optional(),
    availability: requiredEnum(Availability, 'availability').optional(),
    isFeatured: checkbox(),
  })
  .refine((d) => d.status !== undefined || d.availability !== undefined || d.isFeatured !== undefined, {
    error: 'Choose a change to make',
  });

export const BULK_PROPERTY_ACTIONS = ['publish', 'unpublish', 'archive', 'delete', 'restore', 'feature', 'unfeature'] as const;
export const BULK_ARRAY_FIELDS = ['ids'] as const;

export const BulkPropertyActionSchema = z.object({
  ids: z.preprocess(
    (v) => (v === undefined || Array.isArray(v) ? v : [v]),
    z
      .array(uuid('property id'), { error: 'Select at least one property' })
      .min(1, { error: 'Select at least one property' })
      .max(100, { error: 'Select 100 properties or fewer' })
      .transform((ids) => [...new Set(ids)]),
  ),
  action: z.enum(BULK_PROPERTY_ACTIONS, { error: 'Choose an action' }),
});

// ─────────────────────────────────────────────────────────────────────────────
// List filters (URL search params). Never throws: a bad value falls back to its
// default, so a hand-edited URL can't crash the page.
// ─────────────────────────────────────────────────────────────────────────────

export const PROPERTY_SORTS = ['newest', 'oldest', 'price_asc', 'price_desc', 'updated'] as const;

const param = <T extends z.ZodType>(schema: T) => z.preprocess(firstParam, schema.optional()).catch(undefined);

export const PropertyFiltersSchema = z
  .object({
    q: param(z.string().max(80)),
    listingType: param(z.enum(ListingType)),
    category: param(z.enum(PropertyCategory)),
    type: param(z.enum(PropertyType)),
    /** Admin only: public queries must force PUBLISHED and deletedAt: null. */
    status: param(z.enum(ListingStatus)),
    availability: param(z.enum(Availability)),
    state: param(z.string().max(120)),
    city: param(z.string().max(120)),
    minPrice: param(z.coerce.number().min(0)),
    maxPrice: param(z.coerce.number().min(0)),
    minBedrooms: param(z.coerce.number().int().min(0).max(50)),
    featured: param(z.stringbool()),
    /** Admin only: include soft-deleted listings. */
    includeDeleted: param(z.stringbool()),
    sort: z.preprocess(firstParam, z.enum(PROPERTY_SORTS)).catch('newest'),
    page: z.preprocess(firstParam, z.coerce.number().int().min(1).max(10_000)).catch(1),
    pageSize: z.preprocess(firstParam, z.coerce.number().int().min(1).max(100)).catch(20),
  })
  .transform((f) =>
    f.minPrice !== undefined && f.maxPrice !== undefined && f.minPrice > f.maxPrice
      ? { ...f, minPrice: f.maxPrice, maxPrice: f.minPrice }
      : f,
  );

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Validated data, ready for Prisma. */
export type CreatePropertyInput = z.output<typeof CreatePropertySchema>;
export type UpdatePropertyInput = z.output<typeof UpdatePropertySchema>;
export type UpdatePropertyStatusInput = z.output<typeof UpdatePropertyStatusSchema>;
export type BulkPropertyActionInput = z.output<typeof BulkPropertyActionSchema>;
export type PropertyFilters = z.output<typeof PropertyFiltersSchema>;
/** Raw values a form or API body may send. */
export type CreatePropertyValues = z.input<typeof CreatePropertySchema>;
