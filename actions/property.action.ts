'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { parseInput, type FieldErrors } from '@/schemas/form-data';
import { CreatePropertySchema } from '@/schemas/property.schema';

export type CreatePropertyResult =
  | { ok: true; data: { id: string; slug: string } }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

const SLUG_MAX = 200;

/**
 * Creates a listing from the property form's values (the raw input, validated
 * here again with the same schema the browser used). Photos and documents are
 * uploaded afterwards against the returned id.
 *
 * Web address: if the admin typed one and it's taken, they get a field error.
 * If it was generated from the name, a free one is picked ("-2", "-3", …).
 */
export async function createProperty(input: unknown): Promise<CreatePropertyResult> {
  // Throws for signed-out / non-admin callers. Outside the try/catch on purpose.
  const admin = await assertAdmin();

  const parsed = parseInput(CreatePropertySchema, input);
  if (!parsed.success) {
    return { ok: false, error: 'Some fields need attention.', fieldErrors: parsed.fieldErrors };
  }
  const { amenityIds, ...data } = parsed.data;
  const slugWasTyped = typeof (input as { slug?: unknown })?.slug === 'string' && (input as { slug: string }).slug.trim() !== '';

  if (!data.slug) {
    return { ok: false, error: 'Some fields need attention.', fieldErrors: { name: ['Use letters or numbers in the name'] } };
  }

  if (amenityIds.length > 0) {
    const found = await prisma.amenity.count({ where: { id: { in: amenityIds } } });
    if (found !== amenityIds.length) {
      return {
        ok: false,
        error: 'Some fields need attention.',
        fieldErrors: { amenityIds: ['Some of these amenities were removed. Refresh the page and choose again'] },
      };
    }
  }

  let slug = data.slug;
  if (slugWasTyped) {
    if (await slugTaken(slug)) return slugError();
  } else {
    slug = await freeSlug(slug);
  }

  // Two admins saving the same name at once can still clash; retry with a new suffix.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const property = await prisma.$transaction(async (tx) => {
        const created = await tx.property.create({
          data: {
            ...data,
            slug,
            publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
            createdById: admin.id,
            updatedById: admin.id,
            amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
          },
          select: { id: true, slug: true, status: true },
        });
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'Property',
            entityId: created.id,
            changes: { name: data.name, status: data.status },
            actorId: admin.id,
          },
        });
        return created;
      });

      revalidatePath('/admin', 'layout');
      if (property.status === 'PUBLISHED') revalidatePath('/', 'layout');
      return { ok: true, data: { id: property.id, slug: property.slug } };
    } catch (error) {
      if (isUniqueSlugError(error)) {
        if (slugWasTyped) return slugError();
        slug = await freeSlug(data.slug);
        continue;
      }
      console.error('createProperty failed:', error);
      return { ok: false, error: "The property couldn't be saved. Try again in a moment." };
    }
  }
  return { ok: false, error: "The property couldn't be saved. Try again in a moment." };
}

function slugError(): CreatePropertyResult {
  return {
    ok: false,
    error: 'Some fields need attention.',
    fieldErrors: { slug: ['Another property already uses this web address'] },
  };
}

async function slugTaken(slug: string) {
  // Soft-deleted listings keep their slug (the column is unique), so check them too.
  return (await prisma.property.count({ where: { slug } })) > 0;
}

/** "lekki-duplex" → "lekki-duplex", or "lekki-duplex-2", "-3", … if taken. */
async function freeSlug(base: string) {
  const rows = await prisma.property.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * P2002 on the slug column. With driver adapters (Neon) the column names sit in
 * meta.driverAdapterError rather than meta.target, so search the whole meta.
 */
function isUniqueSlugError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  return JSON.stringify(error.meta ?? {}).includes('slug');
}
