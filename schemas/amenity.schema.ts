import * as z from 'zod';
import { optionalText, requiredText, slug, slugify } from './fields';

const amenityId = () =>
  z.coerce.number({ error: 'Invalid amenity' }).int({ error: 'Invalid amenity' }).positive({ error: 'Invalid amenity' });

/** e.g. { name: "24/7 power", group: "Utilities" } → slug "24-7-power" */
export const CreateAmenitySchema = z
  .object({
    name: requiredText('an amenity name', { min: 2, max: 80 }),
    slug: slug(),
    group: optionalText(60),
    icon: optionalText(60),
  })
  .transform((data) => ({ ...data, slug: data.slug ?? slugify(data.name, 80) }));

export const UpdateAmenitySchema = z
  .object({
    id: amenityId(),
    name: requiredText('an amenity name', { min: 2, max: 80 }).optional(),
    slug: slug(),
    group: optionalText(60),
    icon: optionalText(60),
  })
  .refine((d) => Object.entries(d).some(([key, value]) => key !== 'id' && value !== undefined), {
    error: 'There are no changes to save',
  });

export const AmenityIdSchema = z.object({ id: amenityId() });

export type CreateAmenityInput = z.output<typeof CreateAmenitySchema>;
export type UpdateAmenityInput = z.output<typeof UpdateAmenitySchema>;
