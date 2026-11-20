import { Suspense } from 'react';
import { AdminPageHeader } from '@/components/admin/page-header';
import { AdminPageSkeleton } from '@/components/admin/page-skeleton';
import { PropertyForm } from '@/components/admin/property-form/property-form';
import { listAmenities } from '@/lib/admin/queries';
import { requireAgentPage } from '@/lib/auth/guards';

export const metadata = { title: 'Add property' };

export default function AgentNewPropertyPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton />}>
      <AgentNewProperty />
    </Suspense>
  );
}

async function AgentNewProperty() {
  await requireAgentPage('/agent/properties/new');
  const amenities = await listAmenities();
  return (
    <>
      <AdminPageHeader
        title='Add property'
        description='Save it as a draft while you work. When it’s ready, submit it and the team will check it before it goes live.'
      />
      <PropertyForm
        amenities={amenities.map(({ id, name, group }) => ({ id, name, group }))}
        mode={{ kind: 'agent', live: false }}
      />
    </>
  );
}
