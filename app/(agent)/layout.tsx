import { Suspense } from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { countNeedsAttention } from '@/lib/agents/queries';
import { requireAgentPage } from '@/lib/auth/guards';

export const metadata: Metadata = {
  title: { default: 'Agent', template: '%s | ShikiniMoni agent' },
  robots: { index: false, follow: false },
};

/**
 * The agent area: the admin's shell with the agent's menu. Like the admin, each
 * page still runs requireAgentPage() itself, since layouts don't re-run on
 * client-side navigation.
 */
export default function AgentLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<AgentShellSkeleton />}>
      <AgentShell>{children}</AgentShell>
    </Suspense>
  );
}

async function AgentShell({ children }: { children: React.ReactNode }) {
  const { user, agent } = await requireAgentPage('/agent');
  const [cookieStore, needsAttention] = await Promise.all([cookies(), countNeedsAttention(user.id)]);
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AdminSidebar
          area='agent'
          user={{ name: user.name, email: user.email, image: agent.photoUrl }}
          badges={{ needsAttention }}
        />
        <SidebarInset>
          <AdminTopbar area='agent' />
          <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8'>{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position='bottom-right' />
    </TooltipProvider>
  );
}

function AgentShellSkeleton() {
  return (
    <div className='flex min-h-svh w-full bg-sidebar'>
      <div className='hidden w-64 shrink-0 flex-col gap-3 p-4 md:flex'>
        <Skeleton className='h-11 w-36' />
        {Array.from({ length: 4 }, (_, i) => (
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
