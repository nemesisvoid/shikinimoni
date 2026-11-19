'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, ChevronDown, ExternalLink, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import {
  archiveProperty,
  deleteProperty,
  deletePropertyForever,
  restoreProperty,
  unarchiveProperty,
  type PropertyActionResult,
} from '@/actions/property.action';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ListingStatus } from '@/lib/generated/prisma/enums';
import { propertyPath } from '@/lib/listings/search';

type Target = { id: string; name: string; slug: string; status: ListingStatus; deleted: boolean };
type Confirm = 'delete' | 'forever' | null;

/**
 * Archive / delete / restore for one property. `row` is the ⋯ button in the
 * properties table; `page` is the "More" button on the edit page, which goes
 * back to the list after a delete (the edit page no longer exists then).
 */
export function PropertyActions({ property, variant = 'row' }: { property: Target; variant?: 'row' | 'page' }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: (id: string) => Promise<PropertyActionResult>, after?: () => void) =>
    startTransition(async () => {
      try {
        const result = await action(property.id);
        if (result.ok) {
          toast.success(result.message);
          setConfirm(null);
          after?.();
        } else {
          toast.error(result.error);
        }
      } catch {
        // assertAdmin throws when the session has ended.
        toast.error('Your session may have ended. Sign in again and retry.');
      }
    });

  const leavePage = variant === 'page' ? () => router.push('/admin/properties') : undefined;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          render={
            variant === 'row' ? (
              <Button
                variant='ghost'
                size='icon'
                aria-label={`Actions for ${property.name}`}
              />
            ) : (
              <Button variant='outline' />
            )
          }>
          {variant === 'row' ? (
            <MoreHorizontal aria-hidden />
          ) : (
            <>
              More
              <ChevronDown aria-hidden />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='min-w-52'>
          {property.deleted ? (
            <>
              <DropdownMenuItem onClick={() => run(restoreProperty)}>
                <RotateCcw />
                Restore
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setConfirm('forever')}>
                <Trash2 />
                Delete for good…
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {variant === 'row' && (
                <DropdownMenuItem render={<Link href={`/admin/properties/${property.id}`} />}>
                  <Pencil />
                  Edit
                </DropdownMenuItem>
              )}
              {property.status === 'PUBLISHED' && (
                <DropdownMenuItem render={<a href={propertyPath(property.slug)} target='_blank' rel='noopener' />}>
                  <ExternalLink />
                  View on site
                </DropdownMenuItem>
              )}
              {property.status === 'ARCHIVED' ? (
                <DropdownMenuItem onClick={() => run(unarchiveProperty)}>
                  <ArchiveRestore />
                  Unarchive to draft
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => run(archiveProperty)}>
                  <Archive />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setConfirm('delete')}>
                <Trash2 />
                Delete…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={open => !open && !pending && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'forever' ? `Delete “${property.name}” for good?` : `Delete “${property.name}”?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'forever'
                ? 'This removes the listing, its photos and its documents permanently. Enquiries about it are kept. This can’t be undone.'
                : property.status === 'PUBLISHED'
                  ? 'It comes off the site straight away and moves to Deleted, where you can restore it.'
                  : 'It moves to Deleted, where you can restore it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={pending}
              onClick={() => run(confirm === 'forever' ? deletePropertyForever : deleteProperty, confirm === 'delete' ? leavePage : undefined)}>
              {pending ? 'Deleting…' : confirm === 'forever' ? 'Delete for good' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
