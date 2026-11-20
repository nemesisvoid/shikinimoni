import 'server-only';
import NoticeEmail, { type NoticeEmailProps } from '@/emails/notice';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/lib/site';
import { readSiteContact } from '@/lib/site-settings';
import { sendEmail, teamRecipients } from './send';

/**
 * Agent emails. Every function here is called from after() or awaited inside a
 * try, and never throws: email is a side effect, not part of saving.
 */

const absolute = (path: string) => new URL(path, siteConfig.url).toString();
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });

async function notice(to: string | string[], subject: string, props: Omit<NoticeEmailProps, 'address'>, key: string, category: string) {
  try {
    const contact = await readSiteContact();
    return await sendEmail({
      to,
      subject,
      react: NoticeEmail({ ...props, address: contact.officeLines.join(', ') }),
      idempotencyKey: key,
      category,
    });
  } catch (error) {
    console.error(`Email "${category}" failed:`, error);
    return { ok: false as const, skipped: false };
  }
}

/** The personal sign-up link. Returns whether it was sent, so the admin knows to share it another way. */
export async function sendAgentInvite(input: { inviteId: string; email: string; name: string; link: string; expiresAt: Date; invitedBy: string }) {
  const first = input.name.trim().split(/\s+/)[0];
  const result = await notice(
    input.email,
    `You’re invited to list properties on ${siteConfig.name}`,
    {
      preview: `${input.invitedBy} has invited you to join ${siteConfig.name} as an agent`,
      heading: `Join ${siteConfig.name} as an agent`,
      paragraphs: [
        `Hi ${first},`,
        `${input.invitedBy} has invited you to add property listings to ${siteConfig.name}. Create your account with the button below, using this email address. Your listings go live once our team has reviewed them.`,
      ],
      button: { label: 'Create your agent account', href: input.link },
      footnote: `This link works once and expires on ${day.format(input.expiresAt)}. If you weren’t expecting it, you can ignore this email.`,
    },
    `agent-invite-${input.inviteId}-${input.link.slice(-12)}`,
    'agent-invite',
  );
  return result.ok;
}

type ListingRef = { id: string; name: string };

/** Tells the team an agent sent a new listing or changes for review. */
export async function sendSubmittedAlert(listing: ListingRef, agentName: string, kind: 'new' | 'changes') {
  const contact = await readSiteContact().catch(() => null);
  if (!contact) return;
  const what = kind === 'new' ? 'a new listing' : 'changes to a live listing';
  await notice(
    teamRecipients(contact),
    `${kind === 'new' ? 'New listing' : 'Changes'} to review: ${listing.name}`,
    {
      preview: `${agentName} sent ${what} for review`,
      heading: kind === 'new' ? 'A new listing is waiting for review' : 'Changes are waiting for review',
      paragraphs: [
        `${agentName} sent ${what} for review: “${listing.name}”.`,
        kind === 'new'
          ? 'Check it, then publish it, send it back with a note, or reject it.'
          : 'The live listing stays as it is until you approve the changes.',
      ],
      button: { label: 'Review it', href: absolute(`/admin/properties/${listing.id}`) },
    },
    `review-${kind}-${listing.id}-${Date.now()}`,
    'review-submitted',
  );
}

export type ReviewOutcome = 'approved' | 'sent-back' | 'rejected' | 'changes-approved' | 'changes-sent-back' | 'changes-rejected';

/** Tells the agent what happened to their submission. */
export async function sendReviewOutcome(listing: ListingRef & { slug: string }, agentId: string, outcome: ReviewOutcome, note: string | null) {
  const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { email: true, name: true } }).catch(() => null);
  if (!agent) return;
  const first = agent.name?.trim().split(/\s+/)[0] || 'there';
  const COPY: Record<ReviewOutcome, { subject: string; heading: string; body: string; button: { label: string; href: string } }> = {
    approved: {
      subject: `Your listing is live: ${listing.name}`,
      heading: 'Your listing is live',
      body: `“${listing.name}” has been approved and is now on the site.`,
      button: { label: 'See it on the site', href: absolute(`/properties/${listing.slug}`) },
    },
    'sent-back': {
      subject: `Changes needed: ${listing.name}`,
      heading: 'Your listing needs a few changes',
      body: `“${listing.name}” was sent back to you. Make the changes in the note below, then submit it again.`,
      button: { label: 'Edit the listing', href: absolute(`/agent/properties/${listing.id}`) },
    },
    rejected: {
      subject: `Listing not approved: ${listing.name}`,
      heading: 'Your listing wasn’t approved',
      body: `“${listing.name}” won’t be published. The reason is below.`,
      button: { label: 'See your listings', href: absolute('/agent/properties') },
    },
    'changes-approved': {
      subject: `Your changes are live: ${listing.name}`,
      heading: 'Your changes are live',
      body: `Your changes to “${listing.name}” have been approved and are now on the site.`,
      button: { label: 'See it on the site', href: absolute(`/properties/${listing.slug}`) },
    },
    'changes-sent-back': {
      subject: `Changes needed: ${listing.name}`,
      heading: 'Your changes need another look',
      body: `Your changes to “${listing.name}” were sent back. The live listing hasn’t changed. Update your changes using the note below, then submit them again.`,
      button: { label: 'Edit your changes', href: absolute(`/agent/properties/${listing.id}`) },
    },
    'changes-rejected': {
      subject: `Changes not approved: ${listing.name}`,
      heading: 'Your changes weren’t approved',
      body: `Your changes to “${listing.name}” were discarded. The live listing stays as it was.`,
      button: { label: 'See the listing', href: absolute(`/agent/properties/${listing.id}`) },
    },
  };
  const copy = COPY[outcome];
  await notice(
    agent.email,
    copy.subject,
    {
      preview: copy.body,
      heading: copy.heading,
      paragraphs: [`Hi ${first},`, copy.body],
      note: note ? { label: 'Note from the team', text: note } : null,
      button: copy.button,
    },
    `review-outcome-${listing.id}-${outcome}-${Date.now()}`,
    'review-outcome',
  );
}
