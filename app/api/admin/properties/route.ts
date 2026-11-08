import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";

// Admin listing view: includes drafts and archived listings, excludes soft-deleted.
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const properties = await prisma.property.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      refNumber: true,
      slug: true,
      name: true,
      status: true,
      availability: true,
      listingType: true,
      price: true,
      currency: true,
      city: true,
      state: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  return Response.json({ properties });
}
