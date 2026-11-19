'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin, parseRoles } from '@/lib/auth/guards';
import { authAdmin } from '@/lib/auth/server';
import { prisma } from '@/lib/db';
import { parseFormData } from '@/schemas/form-data';
import { AddAdminSchema, UserIdSchema } from '@/schemas/settings.schema';

export type AddAdminState =
  | { status: 'idle' }
  | { status: 'saved'; message: string; savedAt: number }
  | { status: 'error'; message: string; fieldErrors: { email?: string }; email: string; noAccount?: boolean };

export type TeamActionResult = { ok: true; message: string } | { ok: false; error: string };

const FAILED = "That didn't work. Try again in a moment.";

/**
 * Gives an existing account admin access. People create their own account
 * first (so they choose their own password), then an admin adds them here.
 */
export async function addAdmin(_prev: AddAdminState, formData: FormData): Promise<AddAdminState> {
  const admin = await assertAdmin();
  const typed = String(formData.get('email') ?? '').trim();
  const parsed = parseFormData(AddAdminSchema, formData);
  if (!parsed.success) {
    return { status: 'error', message: 'Check the email address.', fieldErrors: { email: parsed.fieldErrors.email?.[0] }, email: typed };
  }
  const { email } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, name: true, email: true, role: true, banned: true },
  });
  if (!user) {
    return {
      status: 'error',
      message: 'No account uses that email.',
      fieldErrors: { email: 'No account uses this email yet' },
      email: typed,
      noAccount: true,
    };
  }
  const label = user.name || user.email;
  if (parseRoles(user.role).includes('admin')) {
    return { status: 'error', message: `${label} is already an admin.`, fieldErrors: { email: 'Already an admin' }, email: typed };
  }
  if (user.banned) {
    return { status: 'error', message: `${label}’s account is blocked.`, fieldErrors: { email: 'This account is blocked' }, email: typed };
  }

  const { error } = await authAdmin.setRole({ userId: user.id, role: 'admin' });
  if (error) {
    console.error('addAdmin failed:', error.status, error.code, error.message);
    return { status: 'error', message: FAILED, fieldErrors: {}, email: typed };
  }
  await audit(user.id, { email: user.email, role: { from: user.role, to: 'admin' } }, admin.id);

  revalidatePath('/admin/team');
  return { status: 'saved', message: `${label} is now an admin. They’ll see the admin area next time they open it.`, savedAt: Date.now() };
}

/** Takes admin access away. Their account stays, as an ordinary site account. */
export async function removeAdmin(userId: unknown): Promise<TeamActionResult> {
  const admin = await assertAdmin();
  const id = UserIdSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: 'That account no longer exists. Refresh the page.' };
  if (id.data === admin.id) return { ok: false, error: 'You can’t remove your own admin access. Ask another admin to do it.' };

  try {
    const admins = await listAdminIds();
    if (!admins.includes(id.data)) return { ok: false, error: 'They’re no longer an admin. Refresh the page.' };
    if (admins.length <= 1) return { ok: false, error: 'There must always be at least one admin.' };

    const user = await prisma.user.findUnique({ where: { id: id.data }, select: { name: true, email: true, role: true } });
    if (!user) return { ok: false, error: 'That account no longer exists. Refresh the page.' };

    const { error } = await authAdmin.setRole({ userId: id.data, role: 'user' });
    if (error) {
      console.error('removeAdmin failed:', error.status, error.code, error.message);
      return { ok: false, error: FAILED };
    }
    await audit(id.data, { email: user.email, role: { from: user.role, to: 'user' } }, admin.id);

    revalidatePath('/admin/team');
    return { ok: true, message: `${user.name || user.email} is no longer an admin.` };
  } catch (error) {
    console.error('removeAdmin failed:', error);
    return { ok: false, error: FAILED };
  }
}

/** Active (not blocked) admins. */
async function listAdminIds() {
  const rows = await prisma.user.findMany({
    where: { role: { contains: 'admin' }, NOT: { banned: true } },
    select: { id: true, role: true },
  });
  return rows.filter(r => parseRoles(r.role).includes('admin')).map(r => r.id);
}

async function audit(userId: string, changes: Record<string, unknown>, actorId: string) {
  await prisma.auditLog
    .create({ data: { action: 'UPDATE', entityType: 'User', entityId: userId, changes: changes as object, actorId } })
    .catch(e => console.error('Audit log for team change failed:', e));
}
