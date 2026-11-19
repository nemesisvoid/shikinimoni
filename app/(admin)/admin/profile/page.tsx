import { Suspense } from 'react';
import { AdminPageHeader, AdminPanel } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { ChangePasswordForm, ProfileNameForm } from '@/components/admin/profile-forms';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Your profile' };

const joined = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });

/** The session check streams into the skeleton, so navigating here is instant. */
export default function AdminProfilePage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AdminProfilePageContent />
    </Suspense>
  );
}

async function AdminProfilePageContent() {
  const admin = await requireAdminPage('/admin/profile');

  return (
    <>
      <AdminPageHeader
        title='Your profile'
        description='Your name and password for this admin.'
      />
      <div className='grid max-w-5xl items-start gap-6 lg:grid-cols-2'>
        <AdminPanel title='Your details'>
          <ProfileNameForm name={admin.name} />
          <dl className='divide-y border-t text-sm'>
            {[
              ['Email', admin.email, 'You sign in with this. It can’t be changed here.'],
              ['Access', 'Admin', null],
              ['Joined', joined.format(new Date(admin.createdAt)), null],
            ].map(([label, value, note]) => (
              <div
                key={label}
                className='grid grid-cols-[6rem_1fr] gap-4 px-5 py-3.5'>
                <dt className='text-muted-foreground'>{label}</dt>
                <dd className='min-w-0'>
                  <span className='font-medium break-all'>{value}</span>
                  {note && <span className='mt-0.5 block text-xs text-muted-foreground'>{note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </AdminPanel>
        <AdminPanel
          title='Password'
          description='You’ll need your current password.'>
          <ChangePasswordForm email={admin.email} />
        </AdminPanel>
      </div>
    </>
  );
}
