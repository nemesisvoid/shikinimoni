import { requireAdminPage } from '@/lib/auth/guards';

const AdminPropertyDetailsPage = async ({ params }: PageProps<'/admin/properties/[id]'>) => {
  const { id } = await params;
  await requireAdminPage(`/admin/properties/${id}`);
  return <div>PropertyDetailsPage</div>;
};

export default AdminPropertyDetailsPage;
