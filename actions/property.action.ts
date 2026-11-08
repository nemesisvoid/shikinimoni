'use server';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';

export const createProperty = async (data: FormData) => {
  // Throws AuthorizationError for signed-out or non-admin callers. Keep it outside
  // the try/catch below so a failed check can't be swallowed.
  const admin = await assertAdmin();

  try {
    // validate `data`, then e.g.:
    // await prisma.property.create({ data: { ...input, createdById: admin.id } });
  } catch (error) {
    console.log('Error creating property:', error);
    return { success: false, error: 'Failed to create property' };
  }
};
