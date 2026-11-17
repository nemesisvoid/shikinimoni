'use client';

import { useActionState, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { createAmenity, deleteAmenity, updateAmenity, type AmenityFormState } from '@/actions/amenity.action';
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
import { Input } from '@/components/ui/input';

export type AmenityItem = { id: number; name: string; group: string | null; listings: number };

const IDLE: AmenityFormState = { status: 'idle' };
const OTHER = 'Other';

/** Add, rename, regroup and remove the amenities admins tick on listings. */
export function AmenitiesManager({ amenities }: { amenities: AmenityItem[] }) {
  const groups = [...new Set(amenities.map(a => a.group).filter((g): g is string => !!g))].sort();
  const byGroup = Map.groupBy(amenities, a => a.group ?? OTHER);
  // Named groups A–Z, "Other" (no group) last.
  const sections = [...byGroup].sort(([a], [b]) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b)));
  const listId = useId();

  return (
    <div className='flex flex-col gap-6'>
      <datalist id={listId}>
        {groups.map(g => (
          <option
            key={g}
            value={g}
          />
        ))}
      </datalist>

      <AddAmenityForm groupListId={listId} />

      {amenities.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-16 text-center'>
          <p className='font-heading text-lg font-bold'>No amenities yet</p>
          <p className='max-w-md text-sm text-muted-foreground'>Add features like “24/7 power” or “Gated estate” above, then tick them on listings.</p>
        </div>
      ) : (
        <div className='grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3'>
          {sections.map(([group, items]) => (
            <section
              key={group}
              aria-labelledby={`amenity-group-${slugId(group)}`}
              className='rounded-2xl border bg-card p-5'>
              <h2
                id={`amenity-group-${slugId(group)}`}
                className='font-heading text-base font-bold'>
                {group}
                <span className='ml-2 text-sm font-normal text-muted-foreground tabular-nums'>{items.length}</span>
              </h2>
              <ul className='mt-3 divide-y'>
                {items.map(a => (
                  <AmenityRow
                    key={a.id}
                    amenity={a}
                    groupListId={listId}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const slugId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function AddAmenityForm({ groupListId }: { groupListId: string }) {
  const [state, formAction, pending] = useActionState(withToast(createAmenity), IDLE);
  const id = useId();
  const errors = state.status === 'error' ? state.fieldErrors : {};
  // After an error the fields refill from `values`; after a save React clears them.
  const values = state.status === 'error' ? state.values : { name: '', group: '' };

  return (
    <form
      action={formAction}
      noValidate
      className='rounded-2xl border bg-card p-5'>
      <h2 className='font-heading text-base font-bold'>Add an amenity</h2>
      <p className='mt-0.5 text-sm text-muted-foreground'>
        Pick an existing group or type a new one. Leave the group empty to file it under Other.
      </p>
      <div className='mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-start'>
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor={`${id}-name`}
            className='text-sm font-medium'>
            Name
          </label>
          <Input
            id={`${id}-name`}
            name='name'
            required
            maxLength={80}
            defaultValue={values.name}
            placeholder='e.g. Solar inverter'
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
          />
          {errors.name && (
            <p
              id={`${id}-name-error`}
              className='text-sm text-destructive'>
              {errors.name}
            </p>
          )}
        </div>
        <div className='flex flex-col gap-1.5'>
          <label
            htmlFor={`${id}-group`}
            className='text-sm font-medium'>
            Group <span className='font-normal text-muted-foreground'>(optional)</span>
          </label>
          <Input
            id={`${id}-group`}
            name='group'
            list={groupListId}
            maxLength={60}
            defaultValue={values.group}
            placeholder='e.g. Utilities'
            aria-invalid={errors.group ? true : undefined}
            aria-describedby={errors.group ? `${id}-group-error` : undefined}
          />
          {errors.group && (
            <p
              id={`${id}-group-error`}
              className='text-sm text-destructive'>
              {errors.group}
            </p>
          )}
        </div>
        <Button
          type='submit'
          disabled={pending}
          className='sm:mt-6.5'>
          <Plus aria-hidden />
          {pending ? 'Adding…' : 'Add amenity'}
        </Button>
      </div>
      {state.status === 'error' && !errors.name && !errors.group && (
        <p
          role='alert'
          className='mt-3 text-sm text-destructive'>
          {state.message}
        </p>
      )}
    </form>
  );
}

function AmenityRow({ amenity, groupListId }: { amenity: AmenityItem; groupListId: string }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [state, formAction, pending] = useActionState(withToast(updateAmenity), IDLE);
  const id = useId();

  // Close the editor once a save comes back (adjusting state during render, not in an effect).
  const [handledSave, setHandledSave] = useState(0);
  if (state.status === 'saved' && state.savedAt !== handledSave) {
    setHandledSave(state.savedAt);
    setEditing(false);
  }

  const remove = () =>
    startDelete(async () => {
      try {
        const result = await deleteAmenity(amenity.id);
        if (result.ok) {
          toast.success(result.message);
          setConfirming(false);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error('Your session may have ended. Sign in again and retry.');
      }
    });

  const listings = `${amenity.listings} ${amenity.listings === 1 ? 'listing' : 'listings'}`;

  if (editing) {
    const errors = state.status === 'error' ? state.fieldErrors : {};
    const values = state.status === 'error' ? state.values : { name: amenity.name, group: amenity.group ?? '' };
    return (
      <li className='py-3'>
        <form
          action={formAction}
          noValidate
          className='flex flex-col gap-2'>
          <input
            type='hidden'
            name='id'
            value={amenity.id}
          />
          <label
            htmlFor={`${id}-name`}
            className='sr-only'>
            Name
          </label>
          <Input
            id={`${id}-name`}
            name='name'
            required
            maxLength={80}
            defaultValue={values.name}
            autoFocus
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${id}-error` : undefined}
          />
          <label
            htmlFor={`${id}-group`}
            className='sr-only'>
            Group
          </label>
          <Input
            id={`${id}-group`}
            name='group'
            list={groupListId}
            maxLength={60}
            defaultValue={values.group}
            placeholder='Group (optional)'
          />
          {(errors.name || errors.group || state.status === 'error') && (
            <p
              id={`${id}-error`}
              role='alert'
              className='text-sm text-destructive'>
              {errors.name ?? errors.group ?? (state.status === 'error' ? state.message : '')}
            </p>
          )}
          <div className='flex gap-2'>
            <Button
              type='submit'
              size='sm'
              disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              disabled={pending}
              onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className='flex items-center justify-between gap-2 py-2'>
      <div className='min-w-0'>
        <p className='truncate text-sm font-medium'>{amenity.name}</p>
        <p className='text-xs text-muted-foreground tabular-nums'>On {listings}</p>
      </div>
      <div className='flex shrink-0 items-center'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={`Edit ${amenity.name}`}
          onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={`Remove ${amenity.name}`}
          className='text-muted-foreground hover:text-destructive'
          onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden />
        </Button>
      </div>

      <AlertDialog
        open={confirming}
        onOpenChange={open => !open && !deleting && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{amenity.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {amenity.listings > 0
                ? `It’s ticked on ${listings}. It will be unticked there and disappear from those pages on the site.`
                : 'No listing uses it, so nothing else changes.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={deleting}
              onClick={remove}>
              {deleting ? 'Removing…' : 'Remove'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/**
 * Toasts from the action call itself rather than an effect: a row that moves to
 * another group remounts, and an effect in the old row would never run.
 */
function withToast(action: (prev: AmenityFormState, formData: FormData) => Promise<AmenityFormState>) {
  return async (prev: AmenityFormState, formData: FormData) => {
    try {
      const next = await action(prev, formData);
      if (next.status === 'saved') toast.success(next.message);
      return next;
    } catch {
      toast.error('Your session may have ended. Sign in again and retry.');
      return prev;
    }
  };
}
