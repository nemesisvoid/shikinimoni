import { Skeleton } from '@/components/ui/skeleton';

/**
 * Content-area placeholder while an admin page checks the session and loads its
 * data. Every admin page renders its content inside <Suspense> with this as the
 * fallback, so the sidebar and top bar stay put and any navigation responds at
 * once (a loading.tsx would only cover navigations from outside /admin).
 */
export function AdminPageSkeleton() {
  return (
    <div
      role='status'
      aria-label='Loading'
      className='flex flex-col gap-6'>
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-9 w-56' />
        <Skeleton className='h-5 w-80 max-w-full' />
      </div>
      <Skeleton className='h-11 w-full max-w-xl rounded-2xl' />
      <div className='flex flex-col gap-3 rounded-2xl border bg-card p-5'>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className='flex items-center gap-3'>
            <Skeleton className='size-11 shrink-0 rounded-lg' />
            <div className='flex flex-1 flex-col gap-2'>
              <Skeleton className='h-4 w-2/5' />
              <Skeleton className='h-3 w-1/4' />
            </div>
            <Skeleton className='hidden h-4 w-20 sm:block' />
          </div>
        ))}
      </div>
    </div>
  );
}
