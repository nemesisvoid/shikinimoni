import { Suspense } from 'react';
import { AgentsManager } from '@/components/admin/agents-manager';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { getAgentsOverview } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';
import { readSiteContact } from '@/lib/site-settings';

export const metadata = { title: 'Agents' };

const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

export default function AdminAgentsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminAgents />
    </Suspense>
  );
}

async function AdminAgents() {
  await requireAdminPage('/admin/agents');
  const [{ agents, invites }, contact] = await Promise.all([getAgentsOverview(), readSiteContact()]);
  return (
    <>
      <AdminPageHeader
        title='Agents'
        description='Agents add listings from their own dashboard. Every new listing, and every change to a live one, waits for an admin in Review.'
      />
      <AgentsManager
        showAgentsSiteWide={contact.showAgentsOnListings}
        agents={agents.map(a => ({
          id: a.userId,
          name: a.user.name,
          email: a.user.email,
          phone: a.phone,
          photoUrl: a.photoUrl,
          status: a.status,
          showOnListings: a.showOnListings,
          joined: date.format(a.createdAt),
          listings: a.listings,
        }))}
        invites={invites.map(i => ({
          id: i.id,
          name: i.name,
          email: i.email,
          expires: date.format(i.expiresAt),
          expired: i.expired,
          invitedBy: i.invitedBy?.name || i.invitedBy?.email || 'a removed admin',
        }))}
      />
    </>
  );
}
