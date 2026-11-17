import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';

/**
 * An admin page asked for something that isn't there (a deleted property, a
 * mistyped id). Non-admins never reach this: the admin layout sends them to the
 * public 404 so the admin area doesn't advertise itself.
 */
export default function AdminNotFound() {
  return (
    <div className='flex flex-1 items-center justify-center py-12'>
      <div className='flex max-w-md flex-col items-center text-center'>
        <span className='grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground'>
          <SearchX
            aria-hidden
            className='size-6'
          />
        </span>
        <h1 className='mt-5 text-h2'>Nothing here</h1>
        <p className='mt-2 text-muted-foreground'>
          It may have been deleted, or the link is out of date. Find it from the properties list instead.
        </p>
        <div className='mt-6 flex flex-wrap justify-center gap-2'>
          <Link
            href='/admin/properties'
            className={buttonVariants()}>
            Go to properties
          </Link>
          <Link
            href='/admin/dashboard'
            className={buttonVariants({ variant: 'outline' })}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
