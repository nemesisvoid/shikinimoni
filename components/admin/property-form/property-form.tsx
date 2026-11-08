"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm, useFormContext, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import { Building2, CircleAlert, CircleCheck, Factory, House, LandPlot, Store, Tractor } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldDescription, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import {
  AVAILABILITY_LABEL,
  CATEGORY_OPTIONS,
  CURRENCIES,
  FURNISHING_LABEL,
  LISTING_TYPE_OPTIONS,
  PRICE_PERIOD_LABEL,
  PRICE_PERIODS_BY_LISTING,
  PROPERTY_TYPE_LABEL,
  SIZE_UNIT_LABEL,
  TITLE_SUGGESTIONS,
} from "@/lib/admin/property-options";
import { COUNTRIES, NIGERIAN_STATES } from "@/lib/data/locations";
import type { ListingType, PropertyCategory } from "@/lib/generated/prisma/enums";
import { slugify } from "@/schemas/fields";
import {
  CreatePropertySchema,
  DEFAULT_PLOT_SQM,
  PROPERTY_TYPES_BY_CATEGORY,
  SQM_PER_UNIT,
  type CreatePropertyInput,
} from "@/schemas/property.schema";
import {
  ChoiceField,
  CountField,
  FormField,
  FormSection,
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
  formatAmount,
  type Choice,
} from "./form-fields";
import { BUILDING_FIELDS, EMPTY_PROPERTY, FORM_SECTIONS, toSchemaInput, type PropertyFormValues } from "./values";

export type AmenityOption = { id: number; name: string; group: string | null };

const CATEGORY_ICONS: Record<PropertyCategory, React.ReactNode> = {
  RESIDENTIAL: <House />,
  LAND: <LandPlot />,
  COMMERCIAL: <Building2 />,
  MIXED_USE: <Store />,
  INDUSTRIAL: <Factory />,
  AGRICULTURAL: <Tractor />,
};

const CATEGORY_CHOICES: Choice[] = Object.entries(CATEGORY_OPTIONS).map(([value, o]) => ({
  value,
  label: o.label,
  hint: o.hint,
  icon: CATEGORY_ICONS[value as PropertyCategory],
}));
const LISTING_CHOICES: Choice[] = Object.entries(LISTING_TYPE_OPTIONS).map(([value, o]) => ({ value, ...o }));
const STATUS_CHOICES: Choice[] = [
  { value: "DRAFT", label: "Draft", hint: "Only admins can see it" },
  { value: "PUBLISHED", label: "Published", hint: "Live on the site once saved" },
];
const CURRENCY_OPTIONS = Object.fromEntries(Object.entries(CURRENCIES).map(([code, c]) => [code, c.label]));
const STATE_OPTIONS = Object.fromEntries(NIGERIAN_STATES.map((s) => [s, s]));
const sqmFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });

/**
 * Validation is CreatePropertySchema, the same schema the server uses, so the
 * browser and the server can't disagree. toSchemaInput() tidies a couple of
 * UI-only values first.
 */
const schemaResolver = zodResolver(CreatePropertySchema);
const resolver: Resolver<PropertyFormValues, unknown, CreatePropertyInput> = (values, context, options) =>
  schemaResolver(toSchemaInput(values), context, options as never) as ReturnType<
    Resolver<PropertyFormValues, unknown, CreatePropertyInput>
  >;

export function PropertyForm({ amenities }: { amenities: AmenityOption[] }) {
  const form = useForm<PropertyFormValues, unknown, CreatePropertyInput>({
    resolver,
    defaultValues: EMPTY_PROPERTY,
    mode: "onTouched",
  });
  const { control, setValue, getValues, handleSubmit, formState } = form;
  const [category, listingType, pricePeriod, currency, country, name, status, landSize, landSizeUnit, landAreaSqm, summary] =
    useWatch({
      control,
      name: [
        "category",
        "listingType",
        "pricePeriod",
        "currency",
        "country",
        "name",
        "status",
        "landSize",
        "landSizeUnit",
        "landAreaSqm",
        "summary",
      ],
    });
  const [validData, setValidData] = useState<CreatePropertyInput | null>(null);

  const isLand = category === "LAND";
  const isSale = listingType === "SALE";
  const currencySymbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!formState.isDirty || validData) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [formState.isDirty, validData]);

  // ── Dependent fields ─────────────────────────────────────────────────────
  const onCategoryChange = (next: string) => {
    const allowed = PROPERTY_TYPES_BY_CATEGORY[next as PropertyCategory] ?? [];
    const type = getValues("type");
    if (type && !allowed.includes(type)) setValue("type", "", { shouldDirty: true });
    // A single option (none today, but cheap to support) needs no choosing.
    if (allowed.length === 1) setValue("type", allowed[0], { shouldDirty: true, shouldValidate: true });
    if (next === "LAND") {
      for (const field of BUILDING_FIELDS) setValue(field, "", { shouldDirty: true });
    }
  };

  const onListingTypeChange = (next: string) => {
    const periods = PRICE_PERIODS_BY_LISTING[next as ListingType];
    if (!periods.includes(getValues("pricePeriod"))) {
      setValue("pricePeriod", periods[0], { shouldDirty: true, shouldValidate: formState.isSubmitted });
    }
  };

  // ── Derived hints ────────────────────────────────────────────────────────
  const typeOptions = category
    ? Object.fromEntries(PROPERTY_TYPES_BY_CATEGORY[category].map((t) => [t, PROPERTY_TYPE_LABEL[t]]))
    : {};
  const periodOptions = Object.fromEntries(PRICE_PERIODS_BY_LISTING[listingType].map((p) => [p, PRICE_PERIOD_LABEL[p]]));

  const parsedSize = Number(landSize.replace(/,/g, ""));
  const estimatedSqm =
    landSize.trim() && landSizeUnit && Number.isFinite(parsedSize) && parsedSize > 0
      ? parsedSize * SQM_PER_UNIT[landSizeUnit]
      : null;

  const slugPreview = slugify(name || "") || "your-property-name";

  // ── Submit ───────────────────────────────────────────────────────────────
  const onValid = (data: CreatePropertyInput) => {
    // Saving isn't wired up yet. Hand `data` (already validated and converted)
    // to the createProperty action here.
    setValidData(data);
  };
  const onInvalid = () => setValidData(null);

  const errorCount = countErrors(formState.errors);
  const sectionHasError = (fields: readonly string[]) => fields.some((f) => f in formState.errors);

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={handleSubmit(onValid, onInvalid)}
        className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="flex flex-col gap-6">
          {/* ── Basics ─────────────────────────────────────────────── */}
          <FormSection id="basics" title="Basics" description="What buyers see first on the listing card and page.">
            <TextField
              name="name"
              label="Property name"
              required
              placeholder="e.g. 4-bedroom terrace duplex with BQ"
              autoComplete="off"
              maxLength={200}
            />
            <TextField
              name="summary"
              label="Short summary"
              description={`Shown on listing cards and in search results. ${summary.length}/500`}
              placeholder="Location, size and the standout feature"
              maxLength={500}
            />
            <TextAreaField
              name="description"
              label="Description"
              required
              description="Layout, finishes, access roads, nearby landmarks and anything a buyer should know. At least 20 characters."
              className="[&_textarea]:min-h-44"
              maxLength={20_000}
            />
            <FormField
              name="slug"
              label="Web address"
              description="Leave blank to use the property name. Lowercase letters, numbers and hyphens only."
            >
              {({ field, a11y }) => (
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>/properties/</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    {...a11y}
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                    onBlur={() => {
                      if (field.value) field.onChange(slugify(field.value));
                      field.onBlur();
                    }}
                    placeholder={slugPreview}
                    autoComplete="off"
                    spellCheck={false}
                    className="pl-0.5!"
                  />
                </InputGroup>
              )}
            </FormField>
          </FormSection>

          {/* ── Listing type ───────────────────────────────────────── */}
          <FormSection id="listing" title="Listing type" description="How it's offered and what kind of property it is.">
            <ChoiceField
              name="listingType"
              legend="Offered"
              required
              choices={LISTING_CHOICES}
              onValueChange={onListingTypeChange}
              className="grid-cols-2 lg:grid-cols-4"
            />
            <ChoiceField
              name="category"
              legend="Category"
              required
              choices={CATEGORY_CHOICES}
              onValueChange={onCategoryChange}
              className="grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3"
            />
            <div className="grid gap-6 md:grid-cols-2">
              <SelectField
                name="type"
                label="Property type"
                required
                options={typeOptions}
                disabled={!category}
                placeholder={category ? "Choose a type" : "Choose a category first"}
              />
              <TextField
                name="titleType"
                label="Title document"
                description="The strongest title the seller holds."
                placeholder="e.g. Certificate of Occupancy"
                list="title-suggestions"
                autoComplete="off"
                maxLength={120}
              />
              <datalist id="title-suggestions">
                {TITLE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </FormSection>

          {/* ── Price ──────────────────────────────────────────────── */}
          <FormSection
            id="price"
            title="Price"
            description="Leave the price empty to show “Price on request” on the listing."
          >
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]">
              <FormField name="price" label={isSale ? "Asking price" : "Rent"}>
                {({ field, a11y }) => (
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText className="text-foreground">{currencySymbol}</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      {...a11y}
                      ref={field.ref}
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={() => {
                        field.onChange(formatAmount(field.value));
                        field.onBlur();
                      }}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      className="font-medium tabular-nums"
                    />
                    {!isSale && (
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>{PRICE_PERIOD_LABEL[pricePeriod].toLowerCase()}</InputGroupText>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                )}
              </FormField>
              <SelectField name="currency" label="Currency" options={CURRENCY_OPTIONS} />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {!isSale && (
                <SelectField name="pricePeriod" label="Charged" required options={periodOptions} />
              )}
              <TextField
                name="serviceCharge"
                label="Service charge"
                description="Yearly estate or facility fee, if any."
                inputMode="decimal"
                autoComplete="off"
                placeholder={`${currencySymbol} 0`}
                format={formatAmount}
                className="[&_input]:tabular-nums"
              />
            </div>
            <SwitchField
              name="isNegotiable"
              label="Price is negotiable"
              description="Adds a “Negotiable” tag next to the price."
            />
          </FormSection>

          {/* ── Size and rooms ─────────────────────────────────────── */}
          <FormSection
            id="size"
            title={isLand ? "Size" : "Size and rooms"}
            description={isLand ? "Land listings are searched by size." : "Leave out anything that doesn't apply."}
          >
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_12rem]">
              <TextField
                name="landSize"
                label="Land size"
                required={isLand}
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 2"
                description={
                  estimatedSqm !== null && !landAreaSqm.trim()
                    ? `About ${sqmFormatter.format(estimatedSqm)} sqm.`
                    : "The size as advertised, in the unit beside it."
                }
              />
              <SelectField name="landSizeUnit" label="Unit" options={SIZE_UNIT_LABEL} />
            </div>
            <TextField
              name="landAreaSqm"
              label="Exact land area (sqm)"
              inputMode="decimal"
              autoComplete="off"
              placeholder={estimatedSqm !== null ? sqmFormatter.format(estimatedSqm) : "e.g. 600"}
              description={`Used for search filters. If left blank it's worked out from the size above${
                landSizeUnit === "PLOT" ? `, counting a plot as ${DEFAULT_PLOT_SQM} sqm (60 × 120 ft)` : ""
              }.`}
              format={formatAmount}
            />

            {!isLand && (
              <>
                <hr className="-mx-5 border-border sm:-mx-6" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
                  <CountField name="bedrooms" label="Bedrooms" />
                  <CountField name="bathrooms" label="Bathrooms" />
                  <CountField name="toilets" label="Toilets" />
                  <CountField name="parkingSpaces" label="Parking" />
                  <CountField name="floors" label="Floors" />
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  <TextField
                    name="floorAreaSqm"
                    label="Floor area (sqm)"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 320"
                    format={formatAmount}
                  />
                  <CountField name="yearBuilt" label="Year built" placeholder="e.g. 2021" maxLength={4} />
                  <SelectField
                    name="furnishing"
                    label="Furnishing"
                    options={{ "": "Not stated", ...FURNISHING_LABEL }}
                    placeholder="Not stated"
                  />
                </div>
              </>
            )}
          </FormSection>

          {/* ── Location ───────────────────────────────────────────── */}
          <FormSection id="location" title="Location">
            <div className="grid gap-6 md:grid-cols-2">
              <SelectField
                name="country"
                label="Country"
                required
                options={COUNTRIES}
                onValueChange={() => setValue("state", "", { shouldDirty: true })}
              />
              {country === "NG" ? (
                <SelectField name="state" label="State" required options={STATE_OPTIONS} placeholder="Choose a state" />
              ) : (
                <TextField name="state" label="State or region" required autoComplete="off" maxLength={120} />
              )}
              <TextField name="city" label="City or town" required placeholder="e.g. Lekki" maxLength={120} />
              <TextField
                name="neighborhood"
                label="Area or estate"
                placeholder="e.g. Lekki Phase 1"
                maxLength={120}
              />
            </div>
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
              <TextField name="addressLine1" label="Street address" placeholder="e.g. 12 Admiralty Way" maxLength={200} />
              <TextField name="addressLine2" label="Address line 2" placeholder="Block, flat or landmark" maxLength={200} />
              <TextField name="postalCode" label="Postcode" maxLength={20} />
            </div>
            <SwitchField
              name="showExactAddress"
              label="Show the street address"
              description="When off, the listing only shows the area, city and state."
            />
            <div className="grid gap-6 md:grid-cols-2">
              <TextField name="latitude" label="Latitude" inputMode="decimal" placeholder="e.g. 6.4474" autoComplete="off" />
              <TextField name="longitude" label="Longitude" inputMode="decimal" placeholder="e.g. 3.4721" autoComplete="off" />
            </div>
            <FieldDescription className="-mt-3">
              For the map pin. In Google Maps, right-click the spot and click the numbers at the top to copy them.
            </FieldDescription>
          </FormSection>

          {/* ── Amenities ──────────────────────────────────────────── */}
          <FormSection id="amenities" title="Amenities" description="Tick everything the property or estate offers.">
            <AmenityPicker amenities={amenities} />
          </FormSection>
        </div>

        {/* ── Publishing (sticky on wide screens) ─────────────────── */}
        <aside className="flex flex-col gap-6 xl:sticky xl:top-6">
          <FormSection id="publishing" title="Publishing">
            <ChoiceField name="status" legend="Visibility" choices={STATUS_CHOICES} className="grid-cols-1" />
            <SelectField
              name="availability"
              label="Availability"
              options={AVAILABILITY_LABEL}
              description="Change it later when the property goes under offer or sells."
            />
            <SwitchField name="isFeatured" label="Feature on the home page" />

            {errorCount > 0 && formState.isSubmitted && (
              <p role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {errorCount === 1 ? "1 field needs attention." : `${errorCount} fields need attention.`}
              </p>
            )}
            {validData && (
              <div role="status" className="flex gap-2 rounded-xl bg-verified p-3 text-sm text-verified-foreground">
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  Everything checks out. Saving isn&apos;t connected yet, so nothing was stored.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button type="submit" size="lg" disabled={formState.isSubmitting}>
                {status === "PUBLISHED" ? "Publish property" : "Save draft"}
              </Button>
              <Link href="/admin/properties" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                Cancel
              </Link>
            </div>
          </FormSection>

          <nav aria-label="Form sections" className="hidden rounded-2xl border bg-card p-2 xl:block">
            <ul>
              {FORM_SECTIONS.filter((s) => s.id !== "publishing").map((section) => {
                const hasError = sectionHasError(section.fields);
                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {section.id === "size" && isLand ? "Size" : section.title}
                      {hasError && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
                          Fix
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      </form>
    </FormProvider>
  );
}

/** Checkbox grid, grouped the way amenities are grouped in the admin. */
function AmenityPicker({ amenities }: { amenities: AmenityOption[] }) {
  const { control } = useFormContext<PropertyFormValues>();
  if (amenities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No amenities set up yet.{" "}
        <Link href="/admin/amenities" className="font-medium text-primary underline-offset-4 hover:underline">
          Add amenities
        </Link>{" "}
        and they&apos;ll show here.
      </p>
    );
  }

  const groups = Map.groupBy(amenities, (a) => a.group ?? "Other");

  return (
    <Controller
      control={control}
      name="amenityIds"
      render={({ field }) => {
        const selected = new Set(field.value);
        const toggle = (id: number, on: boolean) => {
          const next = new Set(selected);
          if (on) next.add(id);
          else next.delete(id);
          field.onChange([...next]);
        };
        return (
          <div className="flex flex-col gap-6">
            {[...groups].map(([group, items]) => (
              <fieldset key={group}>
                <legend className="mb-3 text-sm font-medium">{group}</legend>
                <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((amenity) => {
                    const id = `amenity-${amenity.id}`;
                    return (
                      <FieldLabel
                        key={amenity.id}
                        htmlFor={id}
                        className="w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 font-normal transition-colors hover:bg-muted"
                      >
                        <Checkbox
                          id={id}
                          checked={selected.has(amenity.id)}
                          onCheckedChange={(on) => toggle(amenity.id, on)}
                        />
                        {amenity.name}
                      </FieldLabel>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {selected.size === 0 ? "None selected" : `${selected.size} selected`}
            </p>
          </div>
        );
      }}
    />
  );
}

function countErrors(errors: FieldErrors<PropertyFormValues>) {
  return Object.keys(errors).filter((key) => key !== "root").length;
}
