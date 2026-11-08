import { InquiriesTable } from '@/components/admin/inquiries-list';
import { AdminEmptyState, AdminPageHeader } from '@/components/admin/page-header';
import { listInquiries } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Enquiries' };

export default async function AdminInquiriesPage() {
  await requireAdminPage('/admin/inquiries');
  const rows = await listInquiries();
  const open = rows.filter((q) => q.status === 'NEW' || q.status === 'IN_PROGRESS').length;

  return (
    <>
      <AdminPageHeader
        title='Enquiries'
        description={`${open} open of ${rows.length} total. Newest first.`}
      />
      {rows.length > 0 ? (
        <div className='overflow-hidden rounded-2xl border bg-card'>
          <InquiriesTable rows={rows} />
        </div>
      ) : (
        <AdminEmptyState
          title='No enquiries yet'
          body='When visitors ask about a listing or request a viewing, their messages appear here.'
        />
      )}
    </>
  );
}
