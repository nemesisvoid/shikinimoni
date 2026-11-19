'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { LISTINGS_TAG } from '@/lib/listings/tags';
import { AmenityFormSchema, AmenityIdSchema, EditAmenitySchema } from '@/schemas/amenity.schema';
import { slugify } from '@/schemas/fields';
import { parseFormData } from '@/schemas/form-data';

type Field = 'name' | 'group';

/** What the add / edit forms show after a submit. `values` refills the fields after an error. */
export type AmenityFormState =
  | { status: 'idle' }
  | { status: 'saved'; message: string; savedAt: number }
  | { status: 'error'; message: string; fieldErrors: Partial<Record<Field, string>>; values: Record<Field, string> };

export type AmenityActionResult = { ok: true; message: string } | { ok: false; error: string };

const FAILED = "That didn't save. Try again in a moment.";

/** Adds an amenity admins can tick on listings. */
export async function createAmenity(_prev: AmenityFormState, formData: FormData): Promise<AmenityFormState> {
  const admin = await assertAdmin();
  const values = readValues(formData);
  const parsed = parseFormData(AmenityFormSchema, formData);
  if (!parsed.success) return invalid(parsed.fieldErrors, values);
  const { name } = parsed.data;
  const group = tidyGroup(parsed.data.group);

  const slug = slugify(name, 80);
  if (!slug) return nameError('Use letters or numbers in the name', values);
  if (await nameTaken(name, slug)) return nameError(`There’s already an amenity called “${name}”`, values);

  try {
    const amenity = await prisma.amenity.create({ data: { name, slug, group }, select: { id: true } });
    await audit('CREATE', amenity.id, { name, group }, admin.id);
  } catch (error) {
    if (isUniqueError(error)) return nameError(`There’s already an amenity called “${name}”`, values);
    console.error('createAmenity failed:', error);
    return { status: 'error', message: FAILED, fieldErrors: {}, values };
  }

  revalidate();
  return { status: 'saved', message: `Added “${name}”${group ? ` to ${group}` : ''}.`, savedAt: Date.now() };
}

/** Renames or regroups an amenity. Every listing that has it shows the new name. */
export async function updateAmenity(_prev: AmenityFormState, formData: FormData): Promise<AmenityFormState> {
  const admin = await assertAdmin();
  const values = readValues(formData);
  const parsed = parseFormData(EditAmenitySchema, formData);
  if (!parsed.success) {
    if (parsed.fieldErrors.id) return { status: 'error', message: 'This amenity no longer exists. Refresh the page.', fieldErrors: {}, values };
    return invalid(parsed.fieldErrors, values);
  }
  const { id, name } = parsed.data;
  const group = tidyGroup(parsed.data.group);

  const slug = slugify(name, 80);
  if (!slug) return nameError('Use letters or numbers in the name', values);

  try {
    const existing = await prisma.amenity.findUnique({ where: { id }, select: { name: true, group: true } });
    if (!existing) return { status: 'error', message: 'This amenity no longer exists. Refresh the page.', fieldErrors: {}, values };
    if (existing.name === name && (existing.group ?? null) === group) {
      return { status: 'saved', message: 'Nothing changed.', savedAt: Date.now() };
    }
    if (await nameTaken(name, slug, id)) return nameError(`There’s already an amenity called “${name}”`, values);

    await prisma.amenity.update({ where: { id }, data: { name, slug, group } });
    await audit(
      'UPDATE',
      id,
      {
        ...(existing.name !== name ? { name: { from: existing.name, to: name } } : {}),
        ...((existing.group ?? null) !== group ? { group: { from: existing.group, to: group } } : {}),
      },
      admin.id,
    );
  } catch (error) {
    if (isUniqueError(error)) return nameError(`There’s already an amenity called “${name}”`, values);
    console.error('updateAmenity failed:', error);
    return { status: 'error', message: FAILED, fieldErrors: {}, values };
  }

  revalidate();
  return { status: 'saved', message: `Saved “${name}”.`, savedAt: Date.now() };
}

/** Removes an amenity and unticks it from every listing that had it. */
export async function deleteAmenity(id: unknown): Promise<AmenityActionResult> {
  const admin = await assertAdmin();
  const parsed = AmenityIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: 'This amenity no longer exists. Refresh the page.' };

  try {
    const existing = await prisma.amenity.findUnique({
      where: { id: parsed.data.id },
      select: { name: true, _count: { select: { properties: true } } },
    });
    if (!existing) return { ok: false, error: 'This amenity no longer exists. Refresh the page.' };

    // property_amenities rows go with it (ON DELETE CASCADE).
    await prisma.amenity.delete({ where: { id: parsed.data.id } });
    await audit('DELETE', parsed.data.id, { name: existing.name, listings: existing._count.properties }, admin.id);
    revalidate();
    const n = existing._count.properties;
    return { ok: true, message: `Removed “${existing.name}”${n > 0 ? ` from ${n} ${n === 1 ? 'listing' : 'listings'}` : ''}.` };
  } catch (error) {
    console.error('deleteAmenity failed:', error);
    return { ok: false, error: "That didn't work. Try again in a moment." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readValues(formData: FormData): Record<Field, string> {
  const get = (key: Field) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  return { name: get('name'), group: get('group') };
}

/** "  security " → "Security", so the same group isn't split by typing. Blank → no group ("Other"). */
function tidyGroup(group: string | null | undefined) {
  const trimmed = group?.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

/** Same name ignoring case, or a name that makes the same web slug. */
async function nameTaken(name: string, slug: string, excludeId?: number) {
  const clash = await prisma.amenity.count({
    where: {
      OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return clash > 0;
}

function invalid(fieldErrors: Record<string, string[] | undefined>, values: Record<Field, string>): AmenityFormState {
  return {
    status: 'error',
    message: 'Check the highlighted field.',
    fieldErrors: { name: fieldErrors.name?.[0], group: fieldErrors.group?.[0] },
    values,
  };
}

function nameError(message: string, values: Record<Field, string>): AmenityFormState {
  return { status: 'error', message: 'Check the highlighted field.', fieldErrors: { name: message }, values };
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function audit(action: 'CREATE' | 'UPDATE' | 'DELETE', id: number, changes: Record<string, unknown>, actorId: string) {
  return prisma.auditLog.create({
    data: { action, entityType: 'Amenity', entityId: String(id), changes: changes as Prisma.InputJsonValue, actorId },
  });
}

function revalidate() {
  revalidatePath('/admin', 'layout');
  // Listing pages show amenity names, so cached public pages must refresh too.
  updateTag(LISTINGS_TAG);
}
