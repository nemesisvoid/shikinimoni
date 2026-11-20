'use client';

import { useId, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, CornerUpLeft, X } from 'lucide-react';
import { approveChanges, approveListing, reject, sendBack, type ReviewResult } from '@/actions/review.action';
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
import { Textarea } from '@/components/ui/textarea';
import type { ActivityDetail } from '@/lib/admin/activity';

type Photo = { id: string; url: string };

export type ReviewPanelProps =
  | { kind: 'new'; propertyId: string; agentName: string; submitted: string }
  | {
      kind: 'changes';
      propertyId: string;
      agentName: string;
      submitted: string;
      fields: ActivityDetail[];
      problem: string | null;
      photosAdded: Photo[];
      photosRemoved: Photo[];
      coverChanged: boolean;
      documentsAdded: string[];
      documentsRemoved: string[];
    };

type Dialog = 'send-back' | 'reject' | null;

/**
 * Top of the admin's property page while an agent's submission waits. New
 * listing: check the form below, then publish, send back or reject. Changes to a
 * live listing: the list shows exactly what would change.
 */
export function ReviewPanel(props: ReviewPanelProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noteId = useId();
  const isNew = props.kind === 'new';

  const run = (action: () => Promise<ReviewResult>) =>
    start(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          setDialog(null);
          setNote('');
          router.refresh();
        } else if (dialog) setNoteError(result.error);
        else toast.error(result.error);
      } catch {
        toast.error('Your session may have ended. Sign in again and retry.');
      }
    });

  return (
    <section
      aria-labelledby='review-heading'
      className='rounded-2xl border-2 border-azure-300 bg-azure-50/60 p-5'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div className='min-w-0'>
          <h2
            id='review-heading'
            className='font-heading text-lg font-bold'>
            {isNew ? 'New listing to review' : 'Changes to review'}
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            {props.agentName} submitted {isNew ? 'this listing' : 'changes to this live listing'} {props.submitted}.{' '}
            {isNew
              ? 'Check the details and photos below. You can fix small things and save before approving.'
              : 'The live listing stays as it is until you approve.'}
          </p>
        </div>
        <div className='flex shrink-0 flex-wrap gap-2'>
          <Button
            disabled={pending || (props.kind === 'changes' && !!props.problem)}
            onClick={() => run(() => (isNew ? approveListing(props.propertyId) : approveChanges(props.propertyId)))}>
            <Check aria-hidden />
            {isNew ? 'Approve and publish' : 'Approve changes'}
          </Button>
          <Button
            variant='outline'
            className='bg-background'
            disabled={pending}
            onClick={() => {
              setNoteError(null);
              setDialog('send-back');
            }}>
            <CornerUpLeft aria-hidden />
            Send back
          </Button>
          <Button
            variant='ghost'
            className='text-destructive hover:bg-destructive/10 hover:text-destructive'
            disabled={pending}
            onClick={() => {
              setNoteError(null);
              setDialog('reject');
            }}>
            <X aria-hidden />
            Reject
          </Button>
        </div>
      </div>

      {props.kind === 'changes' && <ChangeList {...props} />}

      <AlertDialog
        open={dialog !== null}
        onOpenChange={open => !open && !pending && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === 'send-back' ? (isNew ? 'Send back to the agent?' : 'Send the changes back?') : isNew ? 'Reject this listing?' : 'Reject these changes?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === 'send-back'
                ? isNew
                  ? 'It goes back to their drafts with your note. They can fix it and submit again.'
                  : 'The live listing doesn’t change. They see your note and can update their changes.'
                : isNew
                  ? 'It won’t be published and can’t be submitted again. They see your note.'
                  : 'Their changes and any photos or documents they added are deleted. The live listing doesn’t change.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label
            htmlFor={noteId}
            className='flex flex-col gap-1.5 text-sm font-medium'>
            {dialog === 'send-back' ? 'What should they change?' : 'Why?'}
            <Textarea
              id={noteId}
              rows={4}
              maxLength={1000}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={dialog === 'send-back' ? 'e.g. The photos are blurry. Add a photo of the C of O.' : 'e.g. We can’t verify the title documents.'}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={`${noteId}-hint`}
            />
            <span
              id={`${noteId}-hint`}
              className={noteError ? 'text-sm font-normal text-destructive' : 'text-xs font-normal text-muted-foreground'}>
              {noteError ?? 'The agent sees this in their dashboard and by email.'}
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant={dialog === 'reject' ? 'destructive' : 'default'}
              disabled={pending}
              onClick={() => run(() => (dialog === 'send-back' ? sendBack(props.propertyId, note) : reject(props.propertyId, note)))}>
              {pending ? 'Sending…' : dialog === 'send-back' ? 'Send back' : 'Reject'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ChangeList(props: Extract<ReviewPanelProps, { kind: 'changes' }>) {
  const nothing =
    props.fields.length === 0 &&
    props.photosAdded.length === 0 &&
    props.photosRemoved.length === 0 &&
    !props.coverChanged &&
    props.documentsAdded.length === 0 &&
    props.documentsRemoved.length === 0;
  return (
    <div className='mt-4 flex flex-col gap-4 rounded-xl bg-background p-4 text-sm'>
      {props.problem && (
        <p
          role='alert'
          className='rounded-lg bg-destructive/10 p-3 text-destructive'>
          These changes don’t pass the listing checks ({props.problem}), so they can’t be approved as they are. Send them back with a note.
        </p>
      )}
      {nothing && !props.problem && <p className='text-muted-foreground'>The agent submitted without changing anything visible.</p>}
      {props.fields.length > 0 && (
        <dl className='grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)]'>
          {props.fields.map(d => (
            <div
              key={d.label}
              className='contents'>
              <dt className='text-muted-foreground'>{d.label}</dt>
              <dd className='min-w-0 break-words'>
                {d.note ? (
                  d.note.charAt(0).toUpperCase() + d.note.slice(1)
                ) : (
                  <>
                    <span className='text-muted-foreground line-through decoration-muted-foreground/50'>{d.from}</span>
                    <span
                      aria-hidden
                      className='mx-1.5 text-muted-foreground'>
                      →
                    </span>
                    <span className='sr-only'>changes to </span>
                    <span className='font-medium'>{d.to}</span>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <PhotoRow
        label='New photos'
        photos={props.photosAdded}
      />
      <PhotoRow
        label='Photos removed'
        photos={props.photosRemoved}
        faded
      />
      {props.coverChanged && <p>The cover photo changes to the agent’s first photo.</p>}
      {props.documentsAdded.length > 0 && <p>New documents: {props.documentsAdded.join(', ')}</p>}
      {props.documentsRemoved.length > 0 && <p>Documents removed: {props.documentsRemoved.join(', ')}</p>}
    </div>
  );
}

function PhotoRow({ label, photos, faded }: { label: string; photos: Photo[]; faded?: boolean }) {
  if (photos.length === 0) return null;
  return (
    <div>
      <p className='mb-2 text-muted-foreground'>
        {label} ({photos.length})
      </p>
      <ul className='flex flex-wrap gap-2'>
        {photos.map(p => (
          <li
            key={p.id}
            className='relative size-20 overflow-hidden rounded-lg bg-muted'>
            <Image
              src={p.url}
              alt=''
              fill
              sizes='80px'
              className={faded ? 'object-cover opacity-50 grayscale' : 'object-cover'}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
