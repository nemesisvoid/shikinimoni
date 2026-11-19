'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth/guards';
import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/db';
import { parseFormData } from '@/schemas/form-data';
import { ChangePasswordSchema, ProfileSchema } from '@/schemas/settings.schema';

export type ProfileState =
  | { status: 'idle' }
  | { status: 'saved'; message: string; savedAt: number; name: string }
  | { status: 'error'; message: string; fieldErrors: { name?: string } };

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

export type PasswordState =
  | { status: 'idle' }
  | { status: 'saved'; message: string; savedAt: number }
  | { status: 'error'; message: string; fieldErrors: Partial<Record<PasswordField, string>> };

const TRY_AGAIN = "That didn't save. Try again in a moment.";
const RATE_LIMITED = 'Too many attempts. Wait a minute, then try again.';

/** Your profile → name. Shown in the admin sidebar and on enquiries you handle. */
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const admin = await assertAdmin();
  const parsed = parseFormData(ProfileSchema, formData);
  if (!parsed.success) {
    return { status: 'error', message: 'Check your name.', fieldErrors: { name: parsed.fieldErrors.name?.[0] } };
  }
  const { name } = parsed.data;
  if (name === admin.name) return { status: 'saved', message: 'Nothing changed.', savedAt: Date.now(), name };

  const { error } = await auth.updateUser({ name });
  if (error) {
    console.error('updateProfile failed:', error.status, error.code, error.message);
    return { status: 'error', message: error.status === 429 ? RATE_LIMITED : TRY_AGAIN, fieldErrors: {} };
  }

  await prisma.auditLog
    .create({
      data: { action: 'UPDATE', entityType: 'User', entityId: admin.id, changes: { name: { from: admin.name, to: name } }, actorId: admin.id },
    })
    .catch(e => console.error('Audit log for updateProfile failed:', e));

  revalidatePath('/admin', 'layout');
  return { status: 'saved', message: 'Name saved.', savedAt: Date.now(), name };
}

/**
 * Your profile → password. Needs the current password. By default every other
 * device is signed out; this one stays signed in.
 */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const admin = await assertAdmin();
  const parsed = parseFormData(ChangePasswordSchema, formData);
  if (!parsed.success) {
    const fe = parsed.fieldErrors;
    return {
      status: 'error',
      message: 'Some fields need attention.',
      fieldErrors: { currentPassword: fe.currentPassword?.[0], newPassword: fe.newPassword?.[0], confirmPassword: fe.confirmPassword?.[0] },
    };
  }
  const { currentPassword, newPassword, signOutOthers = false } = parsed.data;

  const { error } = await auth.changePassword({ currentPassword, newPassword, revokeOtherSessions: signOutOthers });
  if (error) {
    if (error.code === 'invalid_credentials') {
      return { status: 'error', message: 'Some fields need attention.', fieldErrors: { currentPassword: 'That isn’t your current password' } };
    }
    if (error.code === 'weak_password') {
      return { status: 'error', message: 'Some fields need attention.', fieldErrors: { newPassword: 'Use between 8 and 128 characters' } };
    }
    console.error('changePassword failed:', error.status, error.code, error.message);
    return { status: 'error', message: error.status === 429 ? RATE_LIMITED : TRY_AGAIN, fieldErrors: {} };
  }

  await prisma.auditLog
    .create({
      data: {
        action: 'UPDATE',
        entityType: 'User',
        entityId: admin.id,
        // Never the password itself.
        changes: { password: 'changed', signedOutOtherDevices: signOutOthers },
        actorId: admin.id,
      },
    })
    .catch(e => console.error('Audit log for changePassword failed:', e));

  return {
    status: 'saved',
    message: signOutOthers ? 'Password changed. Your other devices are signed out.' : 'Password changed.',
    savedAt: Date.now(),
  };
}
