import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { countNewInquiries } from '@/lib/admin/queries';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: { default: 'Admin', template: '%s | ShikiniMoni admin' } };

/**
 * Admin shell: shadcn sidebar + top bar. It reads cookies (sidebar state, session)
 * and the database, so it renders per request inside Suspense.
 * Each admin page still runs requireAdminPage() itself: layouts don't re-run on
 * client-side navigation, so this check alone wouldn't protect every page.
 */
export default function AdminLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage('/admin/dashboard');
  const [cookieStore, newInquiries] = await Promise.all([cookies(), countNewInquiries()]);
  // shadcn's sidebar remembers open/collapsed in this cookie.
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AdminSidebar
          user={{ name: admin.name, email: admin.email, image: admin.image ?? null }}
          newInquiries={newInquiries}
        />
        <SidebarInset>
          <AdminTopbar />
          <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8'>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function AdminShellSkeleton() {
  return (
    <div className='flex min-h-svh w-full bg-sidebar'>
      <div className='hidden w-64 shrink-0 flex-col gap-3 p-4 md:flex'>
        <Skeleton className='h-11 w-36' />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton
            key={i}
            className='h-8 w-full'
          />
        ))}
      </div>
      <div className='m-2 flex flex-1 flex-col gap-6 rounded-xl bg-background p-6 md:ml-0'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-72 w-full' />
      </div>
    </div>
  );
}
