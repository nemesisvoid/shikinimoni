import { AdminPageHeader, AdminPanel } from '@/components/admin/page-header';
import { parseRoles, requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Settings' };

export default async function AdminSettingsPage() {
  const admin = await requireAdminPage('/admin/settings');
  const roles = parseRoles((admin as { role?: string | null }).role);

  return (
    <>
      <AdminPageHeader title='Settings' description='Your admin account. Site-wide settings will live here too.' />
      <AdminPanel title='Account' className='max-w-2xl'>
        <dl className='divide-y border-t text-sm'>
          {[
            ['Name', admin.name || 'Not set'],
            ['Email', admin.email],
            ['Roles', roles.join(', ') || 'none'],
          ].map(([label, value]) => (
            <div key={label} className='grid grid-cols-[8rem_1fr] gap-4 px-5 py-3.5'>
              <dt className='text-muted-foreground'>{label}</dt>
              <dd className='font-medium break-all'>{value}</dd>
            </div>
          ))}
        </dl>
      </AdminPanel>
    </>
  );
}
