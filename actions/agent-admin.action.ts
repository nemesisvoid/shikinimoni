'use server';

import { revalidatePath, updateTag } from 'next/cache';
import type { Prisma } from '@/lib/generated/prisma/client';
import { inviteLink, newInviteToken } from '@/lib/agents/invites';
import { assertAdmin, parseRoles } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { sendAgentInvite } from '@/lib/email/agents';
import { LISTINGS_TAG } from '@/lib/listings/tags';
import { AgentIdSchema, InviteAgentSchema, InviteIdSchema } from '@/schemas/agent.schema';
import { parseFormData } from '@/schemas/form-data';

/**
 * Admin → Agents: invites, suspending, removing, and whether each agent shows
 * as "Listed by" on their listings.
 */

export type InviteAgentState =
  | { status: 'idle' }
  | { status: 'saved'; message: string; savedAt: number; link: string; emailed: boolean }
  | { status: 'error'; message: string; fieldErrors: { name?: string; email?: string }; values: { name: string; email: string } };

export type AgentActionResult = { ok: true; message: string; link?: string; emailed?: boolean } | { ok: false; error: string };

const FAILED = "That didn't work. Try again in a moment.";

export async function inviteAgent(_prev: InviteAgentState, formData: FormData): Promise<InviteAgentState> {
  const admin = await assertAdmin();
  const values = { name: String(formData.get('name') ?? ''), email: String(formData.get('email') ?? '') };
  const parsed = parseFormData(InviteAgentSchema, formData);
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Check the highlighted fields.',
      fieldErrors: { name: parsed.fieldErrors.name?.[0], email: parsed.fieldErrors.email?.[0] },
      values,
    };
  }
  const { name, email } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { role: true, agent: { select: { status: true } } },
  });
  if (existing?.agent) {
    return { status: 'error', message: 'They’re already an agent.', fieldErrors: { email: 'This email already belongs to an agent' }, values };
  }
  if (existing && parseRoles(existing.role).includes('admin')) {
    return { status: 'error', message: 'Admins can’t also be agents.', fieldErrors: { email: 'This email belongs to an admin' }, values };
  }

  const { token, tokenHash, expiresAt } = newInviteToken();
  let inviteId: string;
  try {
    // One open invite per address: a new one replaces any still waiting.
    const [, invite] = await prisma.$transaction([
      prisma.agentInvite.updateMany({
        where: { email: { equals: email, mode: 'insensitive' }, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.agentInvite.create({ data: { email, name, tokenHash, expiresAt, invitedById: admin.id }, select: { id: true } }),
    ]);
    inviteId = invite.id;
    await audit('CREATE', 'AgentInvite', invite.id, { email, name }, admin.id);
  } catch (error) {
    console.error('inviteAgent failed:', error);
    return { status: 'error', message: FAILED, fieldErrors: {}, values };
  }

  const link = inviteLink(token);
  const emailed = await sendAgentInvite({ inviteId, email, name, link, expiresAt, invitedBy: admin.name || 'The ShikiniMoni team' });
  revalidatePath('/admin/agents');
  return {
    status: 'saved',
    message: emailed ? `Invite sent to ${email}.` : `Invite created for ${email}. Email isn’t set up, so send them the link yourself.`,
    savedAt: Date.now(),
    link,
    emailed,
  };
}

/** A fresh link (the old one stops working) with a new 7 days, emailed again. */
export async function resendInvite(id: unknown): Promise<AgentActionResult> {
  const admin = await assertAdmin();
  const inviteId = InviteIdSchema.safeParse(id);
  if (!inviteId.success) return { ok: false, error: 'That invite no longer exists. Refresh the page.' };
  try {
    const invite = await prisma.agentInvite.findUnique({ where: { id: inviteId.data }, select: { email: true, name: true, acceptedAt: true } });
    if (!invite || invite.acceptedAt) return { ok: false, error: 'That invite has already been used. Refresh the page.' };
    const { token, tokenHash, expiresAt } = newInviteToken();
    await prisma.agentInvite.update({ where: { id: inviteId.data }, data: { tokenHash, expiresAt, revokedAt: null } });
    const link = inviteLink(token);
    const emailed = await sendAgentInvite({ inviteId: inviteId.data, email: invite.email, name: invite.name, link, expiresAt, invitedBy: admin.name || 'The ShikiniMoni team' });
    revalidatePath('/admin/agents');
    return {
      ok: true,
      message: emailed ? `New link sent to ${invite.email}. The old one no longer works.` : 'New link ready. The old one no longer works.',
      link,
      emailed,
    };
  } catch (error) {
    console.error('resendInvite failed:', error);
    return { ok: false, error: FAILED };
  }
}

export async function cancelInvite(id: unknown): Promise<AgentActionResult> {
  const admin = await assertAdmin();
  const inviteId = InviteIdSchema.safeParse(id);
  if (!inviteId.success) return { ok: false, error: 'That invite no longer exists. Refresh the page.' };
  try {
    const { count } = await prisma.agentInvite.updateMany({
      where: { id: inviteId.data, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) return { ok: false, error: 'That invite is no longer open. Refresh the page.' };
    await audit('DELETE', 'AgentInvite', inviteId.data, { cancelled: true }, admin.id);
    revalidatePath('/admin/agents');
    return { ok: true, message: 'Invite cancelled. The link no longer works.' };
  } catch (error) {
    console.error('cancelInvite failed:', error);
    return { ok: false, error: FAILED };
  }
}

/** Suspended agents can't use the agent area; their live listings stay up. */
export async function setAgentStatus(id: unknown, status: 'ACTIVE' | 'SUSPENDED'): Promise<AgentActionResult> {
  const admin = await assertAdmin();
  const agentId = AgentIdSchema.safeParse(id);
  if (!agentId.success || (status !== 'ACTIVE' && status !== 'SUSPENDED')) return { ok: false, error: FAILED };
  try {
    const agent = await prisma.agent.findUnique({ where: { userId: agentId.data }, select: { status: true, user: { select: { name: true, email: true } } } });
    if (!agent) return { ok: false, error: 'That agent no longer exists. Refresh the page.' };
    const label = agent.user.name || agent.user.email;
    if (agent.status === status) return { ok: true, message: status === 'ACTIVE' ? `${label} is already active.` : `${label} is already suspended.` };
    await prisma.agent.update({ where: { userId: agentId.data }, data: { status } });
    await audit('STATUS_CHANGE', 'Agent', agentId.data, { status: { from: agent.status, to: status } }, admin.id);
    revalidatePath('/admin/agents');
    updateTag(LISTINGS_TAG); // "Listed by" only shows active agents
    return {
      ok: true,
      message: status === 'SUSPENDED' ? `${label} is suspended. Their live listings stay up.` : `${label} can use the agent area again.`,
    };
  } catch (error) {
    console.error('setAgentStatus failed:', error);
    return { ok: false, error: FAILED };
  }
}

/** Per-agent "Listed by" switch. The site-wide one in Site settings must be on too. */
export async function setAgentVisibility(id: unknown, show: boolean): Promise<AgentActionResult> {
  const admin = await assertAdmin();
  const agentId = AgentIdSchema.safeParse(id);
  if (!agentId.success) return { ok: false, error: FAILED };
  try {
    const agent = await prisma.agent.update({
      where: { userId: agentId.data },
      data: { showOnListings: show === true },
      select: { user: { select: { name: true, email: true } } },
    });
    await audit('UPDATE', 'Agent', agentId.data, { showOnListings: { from: !show, to: show } }, admin.id);
    revalidatePath('/admin/agents');
    updateTag(LISTINGS_TAG);
    const label = agent.user.name || agent.user.email;
    return { ok: true, message: show ? `${label} is shown on their listings.` : `${label} is hidden on their listings.` };
  } catch (error) {
    console.error('setAgentVisibility failed:', error);
    return { ok: false, error: FAILED };
  }
}

/**
 * Ends someone's agent access. Their account stays (they can still sign in to
 * the site) and their listings become company listings, live ones included.
 */
export async function removeAgent(id: unknown): Promise<AgentActionResult> {
  const admin = await assertAdmin();
  const agentId = AgentIdSchema.safeParse(id);
  if (!agentId.success) return { ok: false, error: FAILED };
  try {
    const agent = await prisma.agent.findUnique({
      where: { userId: agentId.data },
      select: { user: { select: { name: true, email: true } }, _count: { select: { properties: true } } },
    });
    if (!agent) return { ok: false, error: 'That agent no longer exists. Refresh the page.' };
    // The foreign key moves their listings to the company (agentId → null).
    await prisma.agent.delete({ where: { userId: agentId.data } });
    await audit('DELETE', 'Agent', agentId.data, { email: agent.user.email, name: agent.user.name, listings: agent._count.properties }, admin.id);
    revalidatePath('/admin', 'layout');
    updateTag(LISTINGS_TAG);
    const label = agent.user.name || agent.user.email;
    const n = agent._count.properties;
    return { ok: true, message: n ? `${label} is no longer an agent. Their ${n} listing${n === 1 ? '' : 's'} moved to the company.` : `${label} is no longer an agent.` };
  } catch (error) {
    console.error('removeAgent failed:', error);
    return { ok: false, error: FAILED };
  }
}

async function audit(action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE', entityType: string, entityId: string, changes: Record<string, unknown>, actorId: string) {
  await prisma.auditLog
    .create({ data: { action, entityType, entityId, changes: changes as Prisma.InputJsonValue, actorId } })
    .catch(e => console.error('Audit log for agent change failed:', e));
}
