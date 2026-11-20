'use server';

import { findInvite } from '@/lib/agents/invites';
import { getCurrentUser, parseRoles } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';

export type AcceptInviteResult = { ok: true } | { ok: false; error: string };

/**
 * Turns the signed-in account into an agent, if the invite link is still good
 * and was sent to this account's email address. Called by the join page right
 * after the person signs up or signs in.
 */
export async function acceptInvite(token: unknown): Promise<AcceptInviteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Sign in first, then open the link again.' };
  if (typeof token !== 'string') return { ok: false, error: 'This invite link doesn’t work.' };

  const found = await findInvite(token);
  if (found.state !== 'valid') {
    return {
      ok: false,
      error:
        found.state === 'used'
          ? 'This invite has already been used.'
          : found.state === 'expired'
            ? 'This invite has expired. Ask the team for a new one.'
            : 'This invite link doesn’t work. Ask the team for a new one.',
    };
  }
  const { invite } = found;
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: `This invite is for ${invite.email}. Sign out, then sign in or sign up with that address.` };
  }

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, banned: true, agent: { select: { status: true } } } });
  if (!row || row.banned) return { ok: false, error: 'This account can’t be used. Contact the team.' };
  if (parseRoles(row.role).includes('admin')) return { ok: false, error: 'Admin accounts can’t also be agents.' };

  try {
    await prisma.$transaction(async tx => {
      // Claim the invite first, so two tabs can't both use it.
      const claimed = await tx.agentInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) throw new Error('invite already used');
      if (!row.agent) await tx.agent.create({ data: { userId: user.id } });
      await tx.auditLog.create({
        data: { action: 'CREATE', entityType: 'Agent', entityId: user.id, changes: { email: user.email, joined: true }, actorId: user.id },
      });
    });
  } catch (error) {
    console.error('acceptInvite failed:', error);
    return { ok: false, error: 'This invite has already been used.' };
  }
  return { ok: true };
}
