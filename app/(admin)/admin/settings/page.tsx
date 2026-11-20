import { Suspense } from 'react';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { AdminPageHeader } from '@/components/admin/page-header';
import { ListedBySwitch } from '@/components/admin/listed-by-switch';
import { SiteSettingsForm } from '@/components/admin/site-settings-form';
import { prisma } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/guards';
import { readSiteContact } from '@/lib/site-settings';

export const metadata = { title: 'Site settings' };

/** The session check and data load stream into the skeleton, so navigating here is instant. */
export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminSettingsPageContent />
    </Suspense>
  );
}

async function AdminSettingsPageContent() {
  await requireAdminPage('/admin/settings');
  // Uncached, so the form always starts from what's saved.
  const [contact, agentCount] = await Promise.all([readSiteContact(), prisma.agent.count()]);

  return (
    <>
      <AdminPageHeader
        title='Site settings'
        description='Contact details and office hours visitors see, and where enquiry alerts go. Saved changes show on the site straight away.'
      />
      <ListedBySwitch
        initial={contact.showAgentsOnListings}
        agentCount={agentCount}
      />
      <SiteSettingsForm
        contact={contact}
        envAlertFallback={process.env.ENQUIRY_NOTIFY_EMAIL?.trim() || null}
      />
    </>
  );
}
