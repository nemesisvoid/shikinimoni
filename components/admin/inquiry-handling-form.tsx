'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { updateInquiry, type InquiryHandlingState } from '@/actions/inquiry-admin.action';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { INQUIRY_STATUS_HINT } from '@/lib/admin/inquiry-views';
import { INQUIRY_STATUS_META } from '@/lib/admin/meta';
import type { InquiryStatus } from '@/lib/generated/prisma/enums';
import { cn } from '@/lib/utils';

const STATUSES: InquiryStatus[] = ['NEW', 'IN_PROGRESS', 'CLOSED', 'SPAM'];
const NOTES_MAX = 5000;

/**
 * Status + internal notes for one enquiry. Submitted by hand (not <form action>)
 * so React doesn't reset the fields after a save or an error.
 */
export function InquiryHandlingForm({ id, status, notes }: { id: string; status: InquiryStatus; notes: string | null }) {
  const [state, dispatch, pending] = useActionState<InquiryHandlingState, FormData>(updateInquiry, { status: 'idle' });
  const [nextStatus, setNextStatus] = useState(status);
  const [nextNotes, setNextNotes] = useState(notes ?? '');

  useEffect(() => {
    if (state.status === 'saved') toast.success(state.message);
  }, [state]);

  // Compared with what the server has, so it clears once a save comes back.
  const dirty = nextStatus !== status || nextNotes.trim() !== (notes ?? '').trim();
  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};

  return (
    <form
      noValidate
      className='flex flex-col gap-5 px-5 pb-5'
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}>
      <input
        type='hidden'
        name='id'
        value={id}
      />

      <fieldset aria-describedby={errors.status ? 'inquiry-status-error' : undefined}>
        <legend className='mb-2 text-sm font-medium'>Status</legend>
        <div className='flex flex-col gap-1.5'>
          {STATUSES.map(value => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30',
                nextStatus === value ? 'border-primary/50 bg-plum-50/60' : 'hover:bg-muted/60',
              )}>
              <input
                type='radio'
                name='status'
                value={value}
                checked={nextStatus === value}
                onChange={() => setNextStatus(value)}
                className='mt-0.5 size-4 accent-primary'
              />
              <span className='min-w-0'>
                <span className='block text-sm font-medium'>{INQUIRY_STATUS_META[value].label}</span>
                <span className='block text-xs text-muted-foreground'>{INQUIRY_STATUS_HINT[value]}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.status && (
          <p
            id='inquiry-status-error'
            className='mt-1.5 text-sm text-destructive'>
            {errors.status}
          </p>
        )}
      </fieldset>

      <div className='flex flex-col gap-1.5'>
        <label
          htmlFor='inquiry-notes'
          className='text-sm font-medium'>
          Team notes
        </label>
        <Textarea
          id='inquiry-notes'
          name='adminNotes'
          rows={6}
          maxLength={NOTES_MAX}
          value={nextNotes}
          onChange={e => setNextNotes(e.target.value)}
          placeholder='e.g. Called on Tuesday, viewing booked for Saturday 11am.'
          aria-invalid={errors.adminNotes ? true : undefined}
          aria-describedby={errors.adminNotes ? 'inquiry-notes-error' : 'inquiry-notes-hint'}
        />
        {errors.adminNotes ? (
          <p
            id='inquiry-notes-error'
            className='text-sm text-destructive'>
            {errors.adminNotes}
          </p>
        ) : (
          <p
            id='inquiry-notes-hint'
            className='text-xs text-muted-foreground'>
            Only your team sees these. The sender never does.
          </p>
        )}
      </div>

      {state.status === 'error' && (
        <p
          role='alert'
          className='rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive'>
          {state.message}
        </p>
      )}

      <div className='flex items-center gap-3'>
        <Button
          type='submit'
          disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        {dirty && !pending && <span className='text-xs text-muted-foreground'>Unsaved changes</span>}
      </div>
    </form>
  );
}
