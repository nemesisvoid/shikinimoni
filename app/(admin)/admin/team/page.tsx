import { Suspense } from 'react';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { TeamManager } from '@/components/admin/team-manager';
import { getTeam } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';
import { siteConfig } from '@/lib/site';

export const metadata = { title: 'Team' };

const joined = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

/** The session check and data load stream into the skeleton, so navigating here is instant. */
export default function AdminTeamPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminTeamPageContent />
    </Suspense>
  );
}

async function AdminTeamPageContent() {
  const admin = await requireAdminPage('/admin/team');
  const { admins, otherAccounts } = await getTeam();

  return (
    <>
      <AdminPageHeader
        title='Team'
        description={`Who can use this admin. ${otherAccounts === 1 ? '1 other account' : `${otherAccounts} other accounts`} can sign in to the site but not here.`}
      />
      <TeamManager
        currentUserId={admin.id}
        signUpUrl={`${siteConfig.url}/auth/sign-up`}
        admins={admins.map(a => ({
          id: a.id,
          name: a.name,
          email: a.email,
          image: a.image,
          joined: joined.format(a.createdAt),
          blocked: Boolean(a.banned),
        }))}
      />
    </>
  );
}
