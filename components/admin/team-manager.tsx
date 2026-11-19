'use client';

import { useActionState, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, Copy, UserMinus, UserPlus } from 'lucide-react';
import { addAdmin, removeAdmin, type AddAdminState } from '@/actions/team.action';
import { AdminPanel } from '@/components/admin/page-header';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { initialsFor } from '@/lib/format';

export type TeamMember = { id: string; name: string; email: string; image: string | null; joined: string; blocked: boolean };

const SESSION_ENDED = 'Your session may have ended. Sign in again and retry.';

export function TeamManager({ admins, currentUserId, signUpUrl }: { admins: TeamMember[]; currentUserId: string; signUpUrl: string }) {
  const activeAdmins = admins.filter(a => !a.blocked).length;
  return (
    <div className='grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'>
      <AdminPanel
        title='Admins'
        description='Everyone here can manage listings, enquiries and settings.'>
        <ul className='divide-y border-t'>
          {admins.map(member => (
            <AdminRow
              key={member.id}
              member={member}
              isYou={member.id === currentUserId}
              isLast={activeAdmins <= 1}
            />
          ))}
        </ul>
      </AdminPanel>
      <AdminPanel
        title='Add an admin'
        description='They need an account first, so they choose their own password.'>
        <AddAdminForm signUpUrl={signUpUrl} />
      </AdminPanel>
    </div>
  );
}

function AdminRow({ member, isYou, isLast }: { member: TeamMember; isYou: boolean; isLast: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, startRemove] = useTransition();
  const label = member.name || member.email;

  const remove = () =>
    startRemove(async () => {
      try {
        const result = await removeAdmin(member.id);
        if (result.ok) {
          toast.success(result.message);
          setConfirming(false);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(SESSION_ENDED);
      }
    });

  // Why the button is missing, said in words rather than a disabled control.
  const cantRemove = isYou ? 'You' : isLast ? 'Only admin' : null;

  return (
    <li className='flex items-center gap-3 px-5 py-3.5'>
      <Avatar className='size-9 rounded-lg'>
        {member.image && (
          <AvatarImage
            src={member.image}
            alt=''
          />
        )}
        <AvatarFallback className='rounded-lg bg-plum-100 text-xs font-semibold text-plum-900'>{initialsFor(member.name, member.email)}</AvatarFallback>
      </Avatar>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>
          {member.name || 'No name yet'}
          {member.blocked && <span className='ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive'>Blocked</span>}
        </p>
        <p className='truncate text-xs text-muted-foreground'>
          {member.email} · joined {member.joined}
        </p>
      </div>
      {cantRemove ? (
        <span className='shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'>{cantRemove}</span>
      ) : (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='shrink-0 text-muted-foreground hover:text-destructive'
          onClick={() => setConfirming(true)}>
          <UserMinus aria-hidden />
          Remove<span className='sr-only'> {label}</span>
        </Button>
      )}

      <AlertDialog
        open={confirming}
        onOpenChange={open => !open && !removing && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {label} as an admin?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to the admin straight away. Their account stays, so they can still sign in to the site, and you can add them back
              later. Listings and enquiries they worked on aren’t changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Keep them</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={removing}
              onClick={remove}>
              {removing ? 'Removing…' : 'Remove admin'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function AddAdminForm({ signUpUrl }: { signUpUrl: string }) {
  const [state, formAction, pending] = useActionState(async (prev: AddAdminState, formData: FormData) => {
    try {
      const next = await addAdmin(prev, formData);
      if (next.status === 'saved') toast.success(next.message);
      return next;
    } catch {
      toast.error(SESSION_ENDED);
      return prev;
    }
  }, { status: 'idle' } as AddAdminState);
  const id = useId();
  const error = state.status === 'error' ? (state.fieldErrors.email ?? state.message) : undefined;

  return (
    <div className='flex flex-col gap-4 px-5 pb-5'>
      <ol className='flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground marker:text-foreground'>
        <li>Send them the sign-up link below.</li>
        <li>Once they’ve created an account, enter their email here.</li>
      </ol>
      <CopyLink url={signUpUrl} />
      <form
        action={formAction}
        noValidate
        className='flex flex-col gap-1.5'>
        <label
          htmlFor={`${id}-email`}
          className='text-sm font-medium'>
          Their email
        </label>
        <div className='flex gap-2'>
          <Input
            id={`${id}-email`}
            name='email'
            type='email'
            autoComplete='off'
            maxLength={254}
            required
            // After an error the address stays; after a save React clears it.
            key={state.status === 'error' ? `error-${state.email}` : 'fresh'}
            defaultValue={state.status === 'error' ? state.email : ''}
            placeholder='name@example.com'
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <Button
            type='submit'
            disabled={pending}
            className='shrink-0'>
            <UserPlus aria-hidden />
            {pending ? 'Adding…' : 'Add'}
          </Button>
        </div>
        {error && (
          <p
            id={`${id}-error`}
            role='alert'
            className='text-sm text-destructive'>
            {error}
            {state.status === 'error' && state.noAccount && '. Ask them to sign up with the link above first, then try again.'}
          </p>
        )}
      </form>
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className='flex items-center gap-2 rounded-xl border bg-muted/40 py-1 pr-1 pl-3'>
      <span className='min-w-0 flex-1 truncate text-xs'>{url}</span>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error('Couldn’t copy. Select the link and copy it instead.');
          }
        }}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  );
}
