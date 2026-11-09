'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { arrangePropertyDocuments } from '@/actions/document.action';
import { arrangePropertyPhotos } from '@/actions/media.action';
import { createProperty, updateProperty } from '@/actions/property.action';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, FormProvider, useForm, useFormContext, useWatch, type FieldErrors, type Resolver } from 'react-hook-form';
import { Building2, CircleAlert, CircleCheck, Factory, House, LandPlot, Loader2, Store, Tractor } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
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
} from '@/lib/admin/property-options';
import { COUNTRIES, NIGERIAN_STATES } from '@/lib/data/locations';
import { cn } from '@/lib/utils';
import type { ListingType, PropertyCategory } from '@/lib/generated/prisma/enums';
import { slugify } from '@/schemas/fields';
import {
  CreatePropertySchema,
  DEFAULT_PLOT_SQM,
  PROPERTY_TYPES_BY_CATEGORY,
  SQM_PER_UNIT,
  type CreatePropertyInput,
} from '@/schemas/property.schema';
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
} from './form-fields';
import { PhotoPicker } from './photo-picker';
import {
  uploadPropertyDocuments,
  uploadPropertyPhotos,
  type DocumentItem,
  type PhotoItem,
  type SavedDocument,
  type SavedPhoto,
  type StagedDocument,
  type StagedPhoto,
} from './upload-files';
import { DocumentPicker } from './document-picker';
import { BUILDING_FIELDS, EMPTY_PROPERTY, FORM_SECTIONS, toSchemaInput, type PropertyFormValues } from './values';

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
  { value: 'DRAFT', label: 'Draft', hint: 'Only admins can see it' },
  { value: 'PUBLISHED', label: 'Published', hint: 'Live on the site once saved' },
];
/** Editing adds Archived: off the site but kept for records, e.g. a sold property. */
const EDIT_STATUS_CHOICES: Choice[] = [
  ...STATUS_CHOICES,
  { value: 'ARCHIVED', label: 'Archived', hint: 'Off the site, kept for records' },
];
const CURRENCY_OPTIONS = Object.fromEntries(Object.entries(CURRENCIES).map(([code, c]) => [code, c.label]));
const STATE_OPTIONS = Object.fromEntries(NIGERIAN_STATES.map(s => [s, s]));
const sqmFormatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 });

/**
 * Validation is CreatePropertySchema, the same schema the server uses, so the
 * browser and the server can't disagree. toSchemaInput() tidies a couple of
 * UI-only values first.
 */
const schemaResolver = zodResolver(CreatePropertySchema);
const resolver: Resolver<PropertyFormValues, unknown, CreatePropertyInput> = (values, context, options) =>
  schemaResolver(toSchemaInput(values), context, options as never) as ReturnType<Resolver<PropertyFormValues, unknown, CreatePropertyInput>>;

export type ExistingProperty = {
  id: string;
  values: PropertyFormValues;
  photos: SavedPhoto[];
  documents: SavedDocument[];
};

/**
 * Create and edit form. Without `property` it creates a listing; with it, it
 * edits that listing, including its saved photos and documents.
 */
export function PropertyForm({ amenities, property }: { amenities: AmenityOption[]; property?: ExistingProperty }) {
  const isEditing = property !== undefined;
  const form = useForm<PropertyFormValues, unknown, CreatePropertyInput>({
    resolver,
    defaultValues: property?.values ?? EMPTY_PROPERTY,
    mode: 'onTouched',
  });
  const { control, setValue, getValues, setError, handleSubmit, reset, formState } = form;
  const router = useRouter();
  const [category, listingType, pricePeriod, currency, country, name, status, landSize, landSizeUnit, landAreaSqm, summary] = useWatch({
    control,
    name: ['category', 'listingType', 'pricePeriod', 'currency', 'country', 'name', 'status', 'landSize', 'landSizeUnit', 'landAreaSqm', 'summary'],
  });

  // Files live outside react-hook-form: they're not part of the property schema.
  // Saved and new files share one list each, so order and cover work across both.
  const [photos, setPhotos] = useState<PhotoItem[]>(property?.photos ?? []);
  const [documents, setDocuments] = useState<DocumentItem[]>(property?.documents ?? []);
  const [filesDirty, setFilesDirty] = useState(false);
  // What the server holds right now, to work out which saved files were removed.
  const [storedPhotoIds, setStoredPhotoIds] = useState(() => property?.photos.map(p => p.id) ?? []);
  const [storedDocumentIds, setStoredDocumentIds] = useState(() => property?.documents.map(d => d.id) ?? []);

  const changePhotos = (next: PhotoItem[]) => {
    setPhotos(next);
    setFilesDirty(true);
  };
  const changeDocuments = (next: DocumentItem[]) => {
    setDocuments(next);
    setFilesDirty(true);
  };

  // Saving happens in steps: save the details (create or update), upload new
  // photos and documents, then apply order/cover/removals to the saved ones.
  // Once the property exists, a retry updates it instead of creating another,
  // and files that already uploaded are never sent twice.
  const [stage, setStage] = useState<'idle' | 'saving' | 'uploading' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [propertyId, setPropertyId] = useState<string | null>(property?.id ?? null);
  // `filesOnly`: the details saved but some files didn't, so say so.
  const [submitError, setSubmitError] = useState<{ message: string; filesOnly: boolean } | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const isLand = category === 'LAND';
  const isSale = listingType === 'SALE';
  const currencySymbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;
  const hasUnsavedChanges = formState.isDirty || filesDirty;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!hasUnsavedChanges || stage === 'done') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges, stage]);

  // ── Dependent fields ─────────────────────────────────────────────────────
  const onCategoryChange = (next: string) => {
    const allowed = PROPERTY_TYPES_BY_CATEGORY[next as PropertyCategory] ?? [];
    const type = getValues('type');
    if (type && !allowed.includes(type)) setValue('type', '', { shouldDirty: true });
    // A single option (none today, but cheap to support) needs no choosing.
    if (allowed.length === 1) setValue('type', allowed[0], { shouldDirty: true, shouldValidate: true });
    if (next === 'LAND') {
      for (const field of BUILDING_FIELDS) setValue(field, '', { shouldDirty: true });
    }
  };

  const onListingTypeChange = (next: string) => {
    const periods = PRICE_PERIODS_BY_LISTING[next as ListingType];
    if (!periods.includes(getValues('pricePeriod'))) {
      setValue('pricePeriod', periods[0], { shouldDirty: true, shouldValidate: formState.isSubmitted });
    }
  };

  // ── Derived hints ────────────────────────────────────────────────────────
  const typeOptions = category ? Object.fromEntries(PROPERTY_TYPES_BY_CATEGORY[category].map(t => [t, PROPERTY_TYPE_LABEL[t]])) : {};
  const periodOptions = Object.fromEntries(PRICE_PERIODS_BY_LISTING[listingType].map(p => [p, PRICE_PERIOD_LABEL[p]]));

  const parsedSize = Number(landSize.replace(/,/g, ''));
  const estimatedSqm =
    landSize.trim() && landSizeUnit && Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize * SQM_PER_UNIT[landSizeUnit] : null;

  const slugPreview = slugify(name || '') || 'your-property-name';

  // ── Submit ───────────────────────────────────────────────────────────────
  const onValid = async () => {
    setSubmitError(null);
    setSavedNotice(false);
    if (documents.some(d => d.name.trim() === '')) {
      setSubmitError({ message: 'Give every document a name.', filesOnly: false });
      document.getElementById('documents')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // 1. Save the details.
    const existed = propertyId !== null;
    let id: string;
    setStage('saving');
    try {
      // Send the raw values: the server validates them with the same schema.
      const values = toSchemaInput(getValues());
      const result = propertyId ? await updateProperty({ id: propertyId, values }) : await createProperty(values);
      if (!result.ok) {
        setStage('idle');
        if (!showServerErrors(result.fieldErrors)) setSubmitError({ message: result.error, filesOnly: false });
        return;
      }
      id = result.data.id;
      setPropertyId(id);
      // A cleared web address is regenerated on the server; show the real one.
      if (getValues('slug') !== result.data.slug) setValue('slug', result.data.slug);
    } catch {
      setStage('idle');
      setSubmitError({
        message: "The property couldn't be saved. Check your connection and try again. If it keeps failing, sign in again.",
        filesOnly: false,
      });
      return;
    }

    // 2. Upload new files, with one combined progress bar.
    const problems: string[] = [];
    let currentPhotos = photos;
    let currentDocuments = documents;
    const newPhotos = photos.filter((p): p is StagedPhoto => p.kind === 'new');
    const newDocuments = documents.filter((d): d is StagedDocument => d.kind === 'new');
    const photoBytes = sumBytes(newPhotos);
    const totalBytes = Math.max(1, photoBytes + sumBytes(newDocuments));

    if (newPhotos.length + newDocuments.length > 0) {
      setStage('uploading');
      setProgress(0);
    }
    if (newPhotos.length > 0) {
      const result = await safeUpload(() => uploadPropertyPhotos(id, newPhotos, f => setProgress((f * photoBytes) / totalBytes)));
      if (result.ok) {
        currentPhotos = currentPhotos.map(p => result.data.get(p.id) ?? p);
        setPhotos(currentPhotos);
      } else problems.push(`Photos: ${result.error}`);
    }
    if (newDocuments.length > 0) {
      const documentBytes = totalBytes - photoBytes;
      const result = await safeUpload(() =>
        uploadPropertyDocuments(id, newDocuments, f => setProgress((photoBytes + f * documentBytes) / totalBytes)),
      );
      if (result.ok) {
        currentDocuments = currentDocuments.map(d => result.data.get(d.id) ?? d);
        setDocuments(currentDocuments);
      } else problems.push(`Documents: ${result.error}`);
    }

    // 3. Editing: apply order, cover, alt text, document details and removals.
    if (existed) {
      const savedPhotos = currentPhotos.filter((p): p is SavedPhoto => p.kind === 'saved');
      const photoResult = await safeUpload(() =>
        arrangePropertyPhotos({
          propertyId: id,
          photos: savedPhotos.map(p => ({ id: p.id, altText: p.altText })),
          removedIds: storedPhotoIds.filter(storedId => !savedPhotos.some(p => p.id === storedId)),
        }),
      );
      if (photoResult.ok) setStoredPhotoIds(savedPhotos.map(p => p.id));
      else problems.push(`Photos: ${photoResult.error}`);

      const savedDocuments = currentDocuments.filter((d): d is SavedDocument => d.kind === 'saved');
      const documentResult = await safeUpload(() =>
        arrangePropertyDocuments({
          propertyId: id,
          documents: savedDocuments.map(d => ({ id: d.id, name: d.name, type: d.type, isPublic: d.isPublic })),
          removedIds: storedDocumentIds.filter(storedId => !savedDocuments.some(d => d.id === storedId)),
        }),
      );
      if (documentResult.ok) setStoredDocumentIds(savedDocuments.map(d => d.id));
      else problems.push(`Documents: ${documentResult.error}`);
    } else {
      setStoredPhotoIds(currentPhotos.filter(p => p.kind === 'saved').map(p => p.id));
      setStoredDocumentIds(currentDocuments.filter(d => d.kind === 'saved').map(d => d.id));
    }

    // The details are saved either way, so they no longer count as unsaved.
    reset(getValues());

    if (problems.length > 0) {
      setStage('idle');
      setSubmitError({ message: problems.join(' '), filesOnly: true });
      return;
    }
    setFilesDirty(false);
    setProgress(1);

    // 4. New listing → the property list. Edit → stay here with a notice.
    if (!isEditing) {
      setStage('done');
      router.push('/admin/properties');
    } else {
      setStage('idle');
      setSavedNotice(true);
      router.refresh();
    }
  };

  /** Puts server-side field errors on their fields. Returns false if none matched a field. */
  const showServerErrors = (fieldErrors: Record<string, string[] | undefined> = {}) => {
    const entries = Object.entries(fieldErrors).filter(
      (entry): entry is [keyof PropertyFormValues, string[]] => entry[0] in EMPTY_PROPERTY && !!entry[1]?.length,
    );
    entries.forEach(([field, messages], i) => setError(field, { type: 'server', message: messages[0] }, { shouldFocus: i === 0 }));
    return entries.length > 0;
  };

  const onInvalid = () => {
    setSubmitError(null);
    setSavedNotice(false);
  };

  const isBusy = formState.isSubmitting || stage === 'done';
  const createdButIncomplete = !isEditing && propertyId !== null;
  const submitLabel =
    stage === 'saving'
      ? 'Saving…'
      : stage === 'uploading'
        ? `Uploading files… ${Math.round(progress * 100)}%`
        : stage === 'done'
          ? 'Saved'
          : createdButIncomplete
            ? 'Retry upload'
            : isEditing
              ? 'Save changes'
              : status === 'PUBLISHED'
                ? 'Publish property'
                : 'Save draft';

  const errorCount = countErrors(formState.errors);
  const sectionHasError = (fields: readonly string[]) => fields.some(f => f in formState.errors);

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={handleSubmit(onValid, onInvalid)}
        className='grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]'>
        <div className='flex flex-col gap-6'>
          {/* ── Basics ─────────────────────────────────────────────── */}
          <FormSection
            id='basics'
            title='Basics'
            description='What buyers see first on the listing card and page.'>
            <TextField
              name='name'
              label='Property name'
              required
              placeholder='e.g. 4-bedroom terrace duplex with BQ'
              autoComplete='off'
              maxLength={200}
            />
            <TextField
              name='summary'
              label='Short summary'
              description={`Shown on listing cards and in search results. ${summary.length}/500`}
              placeholder='Location, size and the standout feature'
              maxLength={500}
            />
            <TextAreaField
              name='description'
              label='Description'
              required
              description='Layout, finishes, access roads, nearby landmarks and anything a buyer should know. At least 20 characters.'
              className='[&_textarea]:min-h-44'
              maxLength={20_000}
            />
            <FormField
              name='slug'
              label='Web address'
              description='Leave blank to use the property name. Lowercase letters, numbers and hyphens only.'>
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
                    onChange={e => field.onChange(e.target.value.toLowerCase())}
                    onBlur={() => {
                      if (field.value) field.onChange(slugify(field.value));
                      field.onBlur();
                    }}
                    placeholder={slugPreview}
                    autoComplete='off'
                    spellCheck={false}
                    className='pl-0.5!'
                  />
                </InputGroup>
              )}
            </FormField>
          </FormSection>

          {/* ── Photos ─────────────────────────────────────────────── */}
          <FormSection
            id='photos'
            title='Photos'
            description='The first photo is the cover on listing cards. Photos upload when you save.'>
            <PhotoPicker
              photos={photos}
              onChange={changePhotos}
              disabled={isBusy}
            />
          </FormSection>

          {/* ── Listing type ───────────────────────────────────────── */}
          <FormSection
            id='listing'
            title='Listing type'
            description="How it's offered and what kind of property it is.">
            <ChoiceField
              name='listingType'
              legend='Offered'
              required
              choices={LISTING_CHOICES}
              onValueChange={onListingTypeChange}
              className='grid-cols-2 lg:grid-cols-4'
            />
            <ChoiceField
              name='category'
              legend='Category'
              required
              choices={CATEGORY_CHOICES}
              onValueChange={onCategoryChange}
              className='grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3'
            />
            <div className='grid gap-6 md:grid-cols-2'>
              <SelectField
                name='type'
                label='Property type'
                required
                options={typeOptions}
                disabled={!category}
                placeholder={category ? 'Choose a type' : 'Choose a category first'}
              />
              <TextField
                name='titleType'
                label='Title document'
                description='The strongest title the seller holds.'
                placeholder='e.g. Certificate of Occupancy'
                list='title-suggestions'
                autoComplete='off'
                maxLength={120}
              />
              <datalist id='title-suggestions'>
                {TITLE_SUGGESTIONS.map(t => (
                  <option
                    key={t}
                    value={t}
                  />
                ))}
              </datalist>
            </div>
          </FormSection>

          {/* ── Documents ──────────────────────────────────────────── */}
          <FormSection
            id='documents'
            title='Documents'
            description='Optional. Title documents, survey plans and other papers, kept private unless you choose to show them to buyers.'>
            <DocumentPicker
              documents={documents}
              onChange={changeDocuments}
              disabled={isBusy}
            />
          </FormSection>

          {/* ── Price ──────────────────────────────────────────────── */}
          <FormSection
            id='price'
            title='Price'
            description='Leave the price empty to show “Price on request” on the listing.'>
            <div className='grid gap-6 md:grid-cols-[minmax(0,1fr)_14rem]'>
              <FormField
                name='price'
                label={isSale ? 'Asking price' : 'Rent'}>
                {({ field, a11y }) => (
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText className='text-foreground'>{currencySymbol}</InputGroupText>
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
                      inputMode='decimal'
                      autoComplete='off'
                      placeholder='0'
                      className='font-medium tabular-nums'
                    />
                    {!isSale && (
                      <InputGroupAddon align='inline-end'>
                        <InputGroupText>{PRICE_PERIOD_LABEL[pricePeriod].toLowerCase()}</InputGroupText>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                )}
              </FormField>
              <SelectField
                name='currency'
                label='Currency'
                options={CURRENCY_OPTIONS}
              />
            </div>
            <div className='grid gap-6 md:grid-cols-2'>
              {!isSale && (
                <SelectField
                  name='pricePeriod'
                  label='Charged'
                  required
                  options={periodOptions}
                />
              )}
              <TextField
                name='serviceCharge'
                label='Service charge'
                description='Yearly estate or facility fee, if any.'
                inputMode='decimal'
                autoComplete='off'
                placeholder={`${currencySymbol} 0`}
                format={formatAmount}
                className='[&_input]:tabular-nums'
              />
            </div>
            <SwitchField
              name='isNegotiable'
              label='Price is negotiable'
              description='Adds a “Negotiable” tag next to the price.'
            />
          </FormSection>

          {/* ── Size and rooms ─────────────────────────────────────── */}
          <FormSection
            id='size'
            title={isLand ? 'Size' : 'Size and rooms'}
            description={isLand ? 'Land listings are searched by size.' : "Leave out anything that doesn't apply."}>
            <div className='grid gap-6 md:grid-cols-[minmax(0,1fr)_12rem]'>
              <TextField
                name='landSize'
                label='Land size'
                required={isLand}
                inputMode='decimal'
                autoComplete='off'
                placeholder='e.g. 2'
                description={
                  estimatedSqm !== null && !landAreaSqm.trim()
                    ? `About ${sqmFormatter.format(estimatedSqm)} sqm.`
                    : 'The size as advertised, in the unit beside it.'
                }
              />
              <SelectField
                name='landSizeUnit'
                label='Unit'
                options={SIZE_UNIT_LABEL}
              />
            </div>
            <TextField
              name='landAreaSqm'
              label='Exact land area (sqm)'
              inputMode='decimal'
              autoComplete='off'
              placeholder={estimatedSqm !== null ? sqmFormatter.format(estimatedSqm) : 'e.g. 600'}
              description={`Used for search filters. If left blank it's worked out from the size above${
                landSizeUnit === 'PLOT' ? `, counting a plot as ${DEFAULT_PLOT_SQM} sqm (60 × 120 ft)` : ''
              }.`}
              format={formatAmount}
            />

            {!isLand && (
              <>
                <hr className='-mx-5 border-border sm:-mx-6' />
                <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5'>
                  <CountField
                    name='bedrooms'
                    label='Bedrooms'
                  />
                  <CountField
                    name='bathrooms'
                    label='Bathrooms'
                  />
                  <CountField
                    name='toilets'
                    label='Toilets'
                  />
                  <CountField
                    name='parkingSpaces'
                    label='Parking'
                  />
                  <CountField
                    name='floors'
                    label='Floors'
                  />
                </div>
                <div className='grid gap-6 md:grid-cols-3'>
                  <TextField
                    name='floorAreaSqm'
                    label='Floor area (sqm)'
                    inputMode='decimal'
                    autoComplete='off'
                    placeholder='e.g. 320'
                    format={formatAmount}
                  />
                  <CountField
                    name='yearBuilt'
                    label='Year built'
                    placeholder='e.g. 2021'
                    maxLength={4}
                  />
                  <SelectField
                    name='furnishing'
                    label='Furnishing'
                    options={{ '': 'Not stated', ...FURNISHING_LABEL }}
                    placeholder='Not stated'
                  />
                </div>
              </>
            )}
          </FormSection>

          {/* ── Location ───────────────────────────────────────────── */}
          <FormSection
            id='location'
            title='Location'>
            <div className='grid gap-6 md:grid-cols-2'>
              <SelectField
                name='country'
                label='Country'
                required
                options={COUNTRIES}
                onValueChange={() => setValue('state', '', { shouldDirty: true })}
              />
              {country === 'NG' ? (
                <SelectField
                  name='state'
                  label='State'
                  required
                  options={STATE_OPTIONS}
                  placeholder='Choose a state'
                />
              ) : (
                <TextField
                  name='state'
                  label='State or region'
                  required
                  autoComplete='off'
                  maxLength={120}
                />
              )}
              <TextField
                name='city'
                label='City or town'
                required
                placeholder='e.g. Lekki'
                maxLength={120}
              />
              <TextField
                name='neighborhood'
                label='Area or estate'
                placeholder='e.g. Lekki Phase 1'
                maxLength={120}
              />
            </div>
            <div className='grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]'>
              <TextField
                name='addressLine1'
                label='Street address'
                placeholder='e.g. 12 Admiralty Way'
                maxLength={200}
              />
              <TextField
                name='addressLine2'
                label='Address line 2'
                placeholder='Block, flat or landmark'
                maxLength={200}
              />
              <TextField
                name='postalCode'
                label='Postcode'
                maxLength={20}
              />
            </div>
            <SwitchField
              name='showExactAddress'
              label='Show the street address'
              description='When off, the listing only shows the area, city and state.'
            />
            <div className='grid gap-6 md:grid-cols-2'>
              <TextField
                name='latitude'
                label='Latitude'
                inputMode='decimal'
                placeholder='e.g. 6.4474'
                autoComplete='off'
              />
              <TextField
                name='longitude'
                label='Longitude'
                inputMode='decimal'
                placeholder='e.g. 3.4721'
                autoComplete='off'
              />
            </div>
            <FieldDescription className='-mt-3'>
              For the map pin. In Google Maps, right-click the spot and click the numbers at the top to copy them.
            </FieldDescription>
          </FormSection>

          {/* ── Amenities ──────────────────────────────────────────── */}
          <FormSection
            id='amenities'
            title='Amenities'
            description='Tick everything the property or estate offers.'>
            <AmenityPicker amenities={amenities} />
          </FormSection>
        </div>

        {/* ── Publishing (sticky on wide screens) ─────────────────── */}
        <aside className='flex flex-col gap-6 xl:sticky xl:top-6'>
          <FormSection
            id='publishing'
            title='Publishing'>
            <ChoiceField
              name='status'
              legend='Visibility'
              choices={isEditing ? EDIT_STATUS_CHOICES : STATUS_CHOICES}
              className='grid-cols-1'
            />
            <SelectField
              name='availability'
              label='Availability'
              options={AVAILABILITY_LABEL}
              description='Change it later when the property goes under offer or sells.'
            />
            <SwitchField
              name='isFeatured'
              label='Feature on the home page'
            />

            {errorCount > 0 && formState.isSubmitted && (
              <p
                role='alert'
                className='flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive'>
                <CircleAlert
                  aria-hidden
                  className='mt-0.5 size-4 shrink-0'
                />
                {errorCount === 1 ? '1 field needs attention.' : `${errorCount} fields need attention.`}
              </p>
            )}
            {submitError && !formState.isSubmitting && (
              <div
                role='alert'
                className='flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive'>
                <CircleAlert
                  aria-hidden
                  className='mt-0.5 size-4 shrink-0'
                />
                <div className='flex flex-col gap-1'>
                  {submitError.filesOnly && (
                    <p className='font-medium'>
                      {isEditing ? 'Your changes are saved' : 'The property is saved'}, but some files didn&apos;t save.
                    </p>
                  )}
                  <p>{submitError.message}</p>
                  {submitError.filesOnly && <p>Files that already saved won&apos;t be sent again.</p>}
                </div>
              </div>
            )}
            {stage === 'uploading' && (
              <div className='flex flex-col gap-2'>
                <div
                  role='progressbar'
                  aria-label='Upload progress'
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                  className='h-2 overflow-hidden rounded-full bg-muted'>
                  <div
                    className='h-full rounded-full bg-primary transition-[width] duration-200'
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className='text-sm text-muted-foreground'>Keep this page open until the upload finishes.</p>
              </div>
            )}
            {savedNotice && !hasUnsavedChanges && stage === 'idle' && (
              <div
                role='status'
                className='flex gap-2 rounded-xl bg-verified p-3 text-sm text-verified-foreground'>
                <CircleCheck
                  aria-hidden
                  className='mt-0.5 size-4 shrink-0'
                />
                <span>Changes saved.</span>
              </div>
            )}
            {stage === 'done' && (
              <div
                role='status'
                className='flex gap-2 rounded-xl bg-verified p-3 text-sm text-verified-foreground'>
                <CircleCheck
                  aria-hidden
                  className='mt-0.5 size-4 shrink-0'
                />
                <span>{status === 'PUBLISHED' ? 'Published.' : 'Draft saved.'} Opening your properties…</span>
              </div>
            )}

            <div className='flex flex-col gap-2'>
              <Button
                type='submit'
                size='lg'
                disabled={isBusy}
                aria-live='polite'>
                {formState.isSubmitting && <Loader2 aria-hidden className='animate-spin' />}
                {submitLabel}
              </Button>
              <Link
                href='/admin/properties'
                aria-disabled={isBusy}
                tabIndex={isBusy ? -1 : undefined}
                className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), isBusy && 'pointer-events-none opacity-50')}>
                {createdButIncomplete ? 'Continue without the files' : isEditing ? 'Back to properties' : 'Cancel'}
              </Link>
            </div>
          </FormSection>

          <nav
            aria-label='Form sections'
            className='hidden rounded-2xl border bg-card p-2 xl:block'>
            <ul>
              {FORM_SECTIONS.filter(s => s.id !== 'publishing').map(section => {
                const hasError = sectionHasError(section.fields);
                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className='flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'>
                      {section.id === 'size' && isLand ? 'Size' : section.title}
                      {hasError && (
                        <span className='flex items-center gap-1.5 text-xs font-medium text-destructive'>
                          <span
                            aria-hidden
                            className='size-1.5 rounded-full bg-destructive'
                          />
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
      <p className='text-sm text-muted-foreground'>
        No amenities set up yet.{' '}
        <Link
          href='/admin/amenities'
          className='font-medium text-primary underline-offset-4 hover:underline'>
          Add amenities
        </Link>{' '}
        and they&apos;ll show here.
      </p>
    );
  }

  const groups = Map.groupBy(amenities, a => a.group ?? 'Other');

  return (
    <Controller
      control={control}
      name='amenityIds'
      render={({ field, fieldState }) => {
        const selected = new Set(field.value);
        const toggle = (id: number, on: boolean) => {
          const next = new Set(selected);
          if (on) next.add(id);
          else next.delete(id);
          field.onChange([...next]);
        };
        return (
          <div className='flex flex-col gap-6'>
            {[...groups].map(([group, items]) => (
              <fieldset key={group}>
                <legend className='mb-3 text-sm font-medium'>{group}</legend>
                <div className='grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3'>
                  {items.map(amenity => {
                    const id = `amenity-${amenity.id}`;
                    return (
                      <FieldLabel
                        key={amenity.id}
                        htmlFor={id}
                        className='w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 font-normal transition-colors hover:bg-muted'>
                        <Checkbox
                          id={id}
                          checked={selected.has(amenity.id)}
                          onCheckedChange={on => toggle(amenity.id, on)}
                        />
                        {amenity.name}
                      </FieldLabel>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <p
              className='text-sm text-muted-foreground'
              aria-live='polite'>
              {selected.size === 0 ? 'None selected' : `${selected.size} selected`}
            </p>
            {fieldState.error?.message && (
              <p
                role='alert'
                className='text-sm text-destructive'>
                {fieldState.error.message}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}

function countErrors(errors: FieldErrors<PropertyFormValues>) {
  return Object.keys(errors).filter(key => key !== 'root').length;
}

const sumBytes = (items: { file: File }[]) => items.reduce((sum, item) => sum + item.file.size, 0);

/** Upload helpers call server actions, which throw on a dropped connection or an expired session. */
async function safeUpload<T>(run: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
  try {
    return await run();
  } catch {
    return { ok: false as const, error: "The upload didn't finish. Check your connection and try again." };
  }
}
