'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CircleCheck, ExternalLink, MoreHorizontal, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { deleteAgentDraft, discardChanges, setListingAvailability, withdrawSubmission, type AgentActionResult } from '@/actions/agent-property.action';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AgentListingStage } from '@/lib/agents/queries';
import type { Availability } from '@/lib/generated/prisma/enums';

type Target = { id: string; name: string; slug: string; stage: AgentListingStage; availability: Availability; neverLive: boolean };
type Confirm = 'delete' | 'discard' | 'withdraw' | null;

const MARK_AS: { value: Availability; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'UNDER_OFFER', label: 'Under offer' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'RENTED', label: 'Rented' },
];

const CONFIRM_COPY: Record<Exclude<Confirm, null>, { title: string; body: string; action: string }> = {
  delete: { title: 'Delete this draft?', body: 'It disappears from your listings. If you need it back, ask the team.', action: 'Delete draft' },
  discard: {
    title: 'Discard your changes?',
    body: 'Your proposed changes and any photos or documents you added with them are deleted. The live listing stays as it is.',
    action: 'Discard changes',
  },
  withdraw: { title: 'Withdraw from review?', body: 'It goes back to your drafts so you can change it. Submit it again when it’s ready.', action: 'Withdraw' },
};

/** The ⋯ menu on each of the agent's listings. Only offers what the listing's stage allows. */
export function AgentListingActions({ listing }: { listing: Target }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [pending, start] = useTransition();
  const live = listing.stage === 'live' || listing.stage === 'live-changes-pending' || listing.stage === 'live-changes-sent-back';
  const hasChanges = listing.stage === 'live-changes-pending' || listing.stage === 'live-changes-sent-back';
  const canEdit = listing.stage === 'draft' || listing.stage === 'sent-back' || live;
  const canDelete = (listing.stage === 'draft' || listing.stage === 'sent-back' || listing.stage === 'rejected') && listing.neverLive;

  const run = (action: () => Promise<AgentActionResult>, after?: () => void) =>
    start(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          setConfirm(null);
          after?.();
          router.refresh();
        } else toast.error(result.error);
      } catch {
        toast.error('Your session may have ended. Sign in again and retry.');
      }
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon'
              aria-label={`More for ${listing.name}`}
            />
          }>
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='min-w-52'>
          {canEdit && (
            <DropdownMenuItem render={<Link href={`/agent/properties/${listing.id}`} />}>
              <Pencil />
              {live ? (hasChanges ? 'Edit your changes' : 'Suggest changes') : 'Edit'}
            </DropdownMenuItem>
          )}
          {live && (
            <DropdownMenuItem render={<a href={`/properties/${listing.slug}`} target='_blank' rel='noopener' />}>
              <ExternalLink />
              View on site
            </DropdownMenuItem>
          )}
          {listing.stage === 'pending' && (
            <DropdownMenuItem onClick={() => setConfirm('withdraw')}>
              <Undo2 />
              Withdraw to edit
            </DropdownMenuItem>
          )}
          {live && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>Mark as (changes at once)</DropdownMenuLabel>
                {MARK_AS.map(option => (
                  <DropdownMenuItem
                    key={option.value}
                    disabled={pending || option.value === listing.availability}
                    onClick={() => run(() => setListingAvailability(listing.id, option.value))}>
                    {option.value === listing.availability ? <CircleCheck /> : <span className='size-4' />}
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
          {(hasChanges || canDelete) && <DropdownMenuSeparator />}
          {hasChanges && (
            <DropdownMenuItem onClick={() => setConfirm('discard')}>
              <RotateCcw />
              Discard my changes
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              variant='destructive'
              onClick={() => setConfirm('delete')}>
              <Trash2 />
              Delete draft
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={open => !open && !pending && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{CONFIRM_COPY[confirm].title}</AlertDialogTitle>
                <AlertDialogDescription>
                  “{listing.name}”. {CONFIRM_COPY[confirm].body}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
                <Button
                  variant={confirm === 'withdraw' ? 'default' : 'destructive'}
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      confirm === 'delete' ? deleteAgentDraft(listing.id) : confirm === 'discard' ? discardChanges(listing.id) : withdrawSubmission(listing.id),
                    )
                  }>
                  {pending ? 'Working…' : CONFIRM_COPY[confirm].action}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** A primary button for the row: what the agent most likely wants to do next. */
export function AgentListingPrimary({ listing }: { listing: Pick<Target, 'id' | 'stage'> }) {
  const label =
    listing.stage === 'sent-back' || listing.stage === 'live-changes-sent-back'
      ? 'Fix and resubmit'
      : listing.stage === 'draft'
        ? 'Continue'
        : listing.stage === 'live' || listing.stage === 'live-changes-pending'
          ? 'Edit'
          : 'Open';
  return (
    <Link
      href={`/agent/properties/${listing.id}`}
      className={buttonVariants({
        variant: listing.stage === 'sent-back' || listing.stage === 'live-changes-sent-back' ? 'default' : 'outline',
        size: 'sm',
      })}>
      {label}
    </Link>
  );
}
