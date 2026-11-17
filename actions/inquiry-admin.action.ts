'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { INQUIRY_STATUS_META } from '@/lib/admin/meta';
import { parseFormData } from '@/schemas/form-data';
import { UpdateInquirySchema } from '@/schemas/inquiry.schema';

export type InquiryHandlingState =
  | { status: 'idle' }
  | { status: 'saved'; message: string; savedAt: number }
  | { status: 'error'; message: string; fieldErrors?: { status?: string; adminNotes?: string } };

/**
 * Saves the handling panel on an enquiry: its status and the team's internal
 * notes. The first time it leaves "New" (other than as spam) counts as the
 * first response, and whoever did it becomes the person handling it.
 */
export async function updateInquiry(_prev: InquiryHandlingState, formData: FormData): Promise<InquiryHandlingState> {
  // Throws for signed-out / non-admin callers. Outside the try/catch on purpose.
  const admin = await assertAdmin();

  const parsed = parseFormData(UpdateInquirySchema, formData);
  if (!parsed.success) {
    if (parsed.fieldErrors.id) return { status: 'error', message: 'This enquiry no longer exists. Go back to the list.' };
    return {
      status: 'error',
      message: 'Check the highlighted fields.',
      fieldErrors: { status: parsed.fieldErrors.status?.[0], adminNotes: parsed.fieldErrors.adminNotes?.[0] },
    };
  }
  const { id, status } = parsed.data;
  const adminNotes = parsed.data.adminNotes ?? null;
  let statusChanged = false;

  try {
    const existing = await prisma.inquiry.findUnique({
      where: { id },
      select: { status: true, adminNotes: true, respondedAt: true, assignedToId: true },
    });
    if (!existing) return { status: 'error', message: 'This enquiry no longer exists. Go back to the list.' };

    statusChanged = existing.status !== status;
    const notesChanged = (existing.adminNotes ?? null) !== adminNotes;
    if (!statusChanged && !notesChanged) return { status: 'saved', message: 'Nothing changed.', savedAt: Date.now() };

    const firstResponse = existing.status === 'NEW' && status !== 'NEW' && status !== 'SPAM' && !existing.respondedAt;
    const changes: Record<string, unknown> = {};
    if (statusChanged) changes.status = { from: existing.status, to: status };
    // The audit log records that notes changed, not their text.
    if (notesChanged) changes.adminNotes = 'updated';

    await prisma.$transaction([
      prisma.inquiry.update({
        where: { id },
        data: {
          status,
          adminNotes,
          ...(firstResponse ? { respondedAt: new Date() } : {}),
          ...(firstResponse && !existing.assignedToId ? { assignedToId: admin.id } : {}),
        },
      }),
      prisma.auditLog.create({
        data: {
          action: statusChanged ? 'STATUS_CHANGE' : 'UPDATE',
          entityType: 'Inquiry',
          entityId: id,
          changes: changes as Prisma.InputJsonValue,
          actorId: admin.id,
        },
      }),
    ]);
  } catch (error) {
    console.error('updateInquiry failed:', error);
    return { status: 'error', message: "Your changes didn't save. Try again in a moment." };
  }

  // Sidebar badge, dashboard and the enquiries list all show these counts.
  revalidatePath('/admin', 'layout');
  return {
    status: 'saved',
    message: statusChanged ? `Marked as ${INQUIRY_STATUS_META[status].label.toLowerCase()}.` : 'Notes saved.',
    savedAt: Date.now(),
  };
}
