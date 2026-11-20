'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { after } from 'next/server';
import { assertAgent } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { LISTINGS_TAG } from '@/lib/listings/tags';
import { agentObjectKey, createUploadUrl, deleteObjects, getObjectInfo, isStorageConfigured, publicUrlFor } from '@/lib/storage/r2';
import { AGENT_PHOTO_TYPES, AgentPhotoKeySchema, AgentPhotoUploadSchema, MAX_AGENT_PHOTO_BYTES } from '@/schemas/agent.schema';
import { optionalText } from '@/schemas/fields';

/** An agent's own details beyond name and password (those use actions/account.action.ts). */

export type PhoneState =
  | { status: 'idle' }
  | { status: 'saved'; message: string; savedAt: number }
  | { status: 'error'; message: string; fieldErrors: { phone?: string } };

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const FAILED = "That didn't save. Try again in a moment.";
const NOT_CONFIGURED = "Photo storage isn't set up yet, so photos can't be uploaded.";

const PhoneSchema = optionalText(40).refine(
  v => !v || (/^\+?[\d\s()-]+$/.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15),
  { error: 'Enter a phone number, e.g. 0803 123 4567' },
);

/** For the team to reach the agent. Never shown on the site. */
export async function updateAgentPhone(_prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const agent = await assertAgent();
  const parsed = PhoneSchema.safeParse(formData.get('phone') ?? '');
  if (!parsed.success) return { status: 'error', message: 'Check the phone number.', fieldErrors: { phone: parsed.error.issues[0]?.message } };
  const phone = parsed.data ?? null;
  try {
    const before = await prisma.agent.findUnique({ where: { userId: agent.id }, select: { phone: true } });
    if ((before?.phone ?? null) === phone) return { status: 'saved', message: 'Nothing changed.', savedAt: Date.now() };
    await prisma.agent.update({ where: { userId: agent.id }, data: { phone } });
    await prisma.auditLog.create({
      data: { action: 'UPDATE', entityType: 'Agent', entityId: agent.id, changes: { phone: { from: before?.phone ?? null, to: phone } }, actorId: agent.id },
    });
  } catch (error) {
    console.error('updateAgentPhone failed:', error);
    return { status: 'error', message: FAILED, fieldErrors: {} };
  }
  revalidatePath('/agent', 'layout');
  revalidatePath('/admin/agents');
  return { status: 'saved', message: phone ? 'Phone number saved.' : 'Phone number removed.', savedAt: Date.now() };
}

/** Step 1 of a new photo: a signed upload URL for exactly this type and size. */
export async function requestAgentPhotoUpload(input: unknown): Promise<Result<{ key: string; uploadUrl: string }>> {
  const agent = await assertAgent();
  if (!isStorageConfigured('media')) return { ok: false, error: NOT_CONFIGURED };
  const parsed = AgentPhotoUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Use a JPG, PNG or WebP image under 5 MB.' };
  const key = agentObjectKey(agent.id, parsed.data.contentType);
  const uploadUrl = await createUploadUrl('media', { key, contentType: parsed.data.contentType, sizeBytes: parsed.data.sizeBytes });
  return { ok: true, data: { key, uploadUrl } };
}

/** Step 2: check the upload landed, then make it the agent's photo (the old one is deleted). */
export async function saveAgentPhoto(key: unknown): Promise<Result<{ url: string }>> {
  const agent = await assertAgent();
  if (!isStorageConfigured('media')) return { ok: false, error: NOT_CONFIGURED };
  const parsed = AgentPhotoKeySchema.safeParse(key);
  if (!parsed.success || !parsed.data.startsWith(`agents/${agent.id}/`) || parsed.data.includes('..')) {
    return { ok: false, error: 'That upload didn’t work. Try again.' };
  }
  const info = await getObjectInfo('media', parsed.data);
  if (!info || info.sizeBytes <= 0 || info.sizeBytes > MAX_AGENT_PHOTO_BYTES || !(AGENT_PHOTO_TYPES as readonly string[]).includes(info.contentType)) {
    await deleteObjects('media', [parsed.data]).catch(() => {});
    return { ok: false, error: 'That upload didn’t work. Use a JPG, PNG or WebP image under 5 MB.' };
  }
  try {
    const before = await prisma.agent.findUnique({ where: { userId: agent.id }, select: { photoKey: true } });
    const url = publicUrlFor(parsed.data);
    await prisma.agent.update({ where: { userId: agent.id }, data: { photoKey: parsed.data, photoUrl: url } });
    await prisma.auditLog.create({ data: { action: 'UPDATE', entityType: 'Agent', entityId: agent.id, changes: { photo: 'changed' }, actorId: agent.id } });
    if (before?.photoKey) {
      const old = before.photoKey;
      after(() => deleteObjects('media', [old]).catch(error => console.error('Old agent photo cleanup failed:', error)));
    }
    refresh();
    return { ok: true, data: { url } };
  } catch (error) {
    console.error('saveAgentPhoto failed:', error);
    return { ok: false, error: FAILED };
  }
}

export async function removeAgentPhoto(): Promise<Result<null>> {
  const agent = await assertAgent();
  try {
    const before = await prisma.agent.findUnique({ where: { userId: agent.id }, select: { photoKey: true } });
    if (!before?.photoKey) return { ok: true, data: null };
    await prisma.agent.update({ where: { userId: agent.id }, data: { photoKey: null, photoUrl: null } });
    await prisma.auditLog.create({ data: { action: 'UPDATE', entityType: 'Agent', entityId: agent.id, changes: { photo: 'removed' }, actorId: agent.id } });
    const old = before.photoKey;
    if (isStorageConfigured('media')) after(() => deleteObjects('media', [old]).catch(error => console.error('Agent photo cleanup failed:', error)));
    refresh();
    return { ok: true, data: null };
  } catch (error) {
    console.error('removeAgentPhoto failed:', error);
    return { ok: false, error: FAILED };
  }
}

function refresh() {
  revalidatePath('/agent', 'layout');
  revalidatePath('/admin/agents');
  updateTag(LISTINGS_TAG); // the photo can show as "Listed by"
}
