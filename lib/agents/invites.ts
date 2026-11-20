import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/lib/site';

/**
 * Personal agent invites. The link carries a random token; only its SHA-256
 * hash is stored, so a database leak can't be turned into working links. A link
 * works once, for one email address, until it expires.
 */

export const INVITE_DAYS = 7;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function newInviteToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) };
}

export const inviteLink = (token: string) => new URL(`/join/${token}`, siteConfig.url).toString();

export type InviteState =
  | { state: 'valid'; invite: { id: string; email: string; name: string; expiresAt: Date } }
  | { state: 'used' | 'expired' | 'cancelled' | 'unknown' };

/** Looks up a link's invite and says whether it can still be used. */
export async function findInvite(token: string): Promise<InviteState> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { state: 'unknown' };
  const invite = await prisma.agentInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, email: true, name: true, expiresAt: true, acceptedAt: true, revokedAt: true },
  });
  if (!invite) return { state: 'unknown' };
  if (invite.acceptedAt) return { state: 'used' };
  if (invite.revokedAt) return { state: 'cancelled' };
  if (invite.expiresAt.getTime() < Date.now()) return { state: 'expired' };
  return { state: 'valid', invite: { id: invite.id, email: invite.email, name: invite.name, expiresAt: invite.expiresAt } };
}
