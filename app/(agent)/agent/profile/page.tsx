import { Suspense } from 'react';
import { AgentPhoneForm, AgentPhotoForm } from '@/components/agent/profile-extras';
import { AdminPageHeader, AdminPanel } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { ChangePasswordForm, ProfileNameForm } from '@/components/admin/profile-forms';
import { requireAgentPage } from '@/lib/auth/guards';

export const metadata = { title: 'Your profile' };

export default function AgentProfilePage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AgentProfile />
    </Suspense>
  );
}

async function AgentProfile() {
  const { user, agent } = await requireAgentPage('/agent/profile');
  return (
    <>
      <AdminPageHeader
        title='Your profile'
        description='Your name and photo can appear beside your listings, if the team turns that on.'
      />
      <div className='grid max-w-5xl items-start gap-6 lg:grid-cols-2'>
        <div className='flex flex-col gap-6'>
          <AdminPanel title='Photo'>
            <AgentPhotoForm
              photoUrl={agent.photoUrl}
              name={user.name}
              email={user.email}
            />
          </AdminPanel>
          <AdminPanel title='Your details'>
            <ProfileNameForm
              name={user.name}
              hint='Can show as “Listed by” on your listings.'
            />
            <AgentPhoneForm phone={agent.phone} />
            <dl className='divide-y border-t text-sm'>
              <div className='grid grid-cols-[6rem_1fr] gap-4 px-5 py-3.5'>
                <dt className='text-muted-foreground'>Email</dt>
                <dd className='min-w-0'>
                  <span className='font-medium break-all'>{user.email}</span>
                  <span className='mt-0.5 block text-xs text-muted-foreground'>You sign in with this. Ask the team if it needs to change.</span>
                </dd>
              </div>
            </dl>
          </AdminPanel>
        </div>
        <AdminPanel
          title='Password'
          description='You’ll need your current password.'>
          <ChangePasswordForm email={user.email} />
        </AdminPanel>
      </div>
    </>
  );
}
