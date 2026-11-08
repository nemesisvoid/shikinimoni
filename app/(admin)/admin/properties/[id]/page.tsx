import { requireAdmin } from '@/lib/auth/guards';
const AdminPropertyDetailsPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  return <div>PropertyDetailsPage</div>;
};

export default AdminPropertyDetailsPage;
