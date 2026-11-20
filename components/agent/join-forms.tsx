'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Loader2 } from 'lucide-react';
import { acceptInvite } from '@/actions/join.action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth/client';

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role='alert'
      className='flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive'>
      <CircleAlert
        aria-hidden
        className='mt-0.5 size-4 shrink-0'
      />
      {message}
    </p>
  );
}

/** New to ShikiniMoni: create the account (email fixed to the invite), then accept. */
export function JoinSignUpForm({ token, name, email }: { token: string; name: string; email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ password?: string; confirm?: string }>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const errors = {
      password: password.length < 8 ? 'Use at least 8 characters' : undefined,
      confirm: password && confirm !== password ? 'This doesn’t match your password' : undefined,
    };
    setFieldError(errors);
    if (errors.password || errors.confirm) return;

    setPending(true);
    try {
      const { error: signUpError } = await authClient.signUp.email({ email, password, name: String(form.get('name') ?? '').trim() || name });
      if (signUpError) {
        setError(signUpError.message ?? 'Your account couldn’t be created. Try again.');
        return;
      }
      const accepted = await acceptInvite(token);
      if (!accepted.ok) {
        setError(accepted.error);
        return;
      }
      router.replace('/agent?welcome=1');
      router.refresh();
    } catch {
      setError('Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className='mt-6 flex flex-col gap-4'>
      <label className='flex flex-col gap-1.5 text-sm font-medium'>
        Your name
        <Input
          name='name'
          defaultValue={name}
          autoComplete='name'
          maxLength={80}
          required
        />
      </label>
      <label className='flex flex-col gap-1.5 text-sm font-medium'>
        Email
        <Input
          name='email'
          type='email'
          value={email}
          readOnly
          autoComplete='username'
          className='bg-muted text-muted-foreground'
        />
        <span className='text-xs font-normal text-muted-foreground'>The invite is for this address.</span>
      </label>
      <label className='flex flex-col gap-1.5 text-sm font-medium'>
        Password
        <Input
          name='password'
          type='password'
          autoComplete='new-password'
          minLength={8}
          maxLength={128}
          required
          aria-invalid={fieldError.password ? true : undefined}
          aria-describedby='join-password-note'
        />
        <span
          id='join-password-note'
          className={fieldError.password ? 'text-sm font-normal text-destructive' : 'text-xs font-normal text-muted-foreground'}>
          {fieldError.password ?? 'At least 8 characters'}
        </span>
      </label>
      <label className='flex flex-col gap-1.5 text-sm font-medium'>
        Password again
        <Input
          name='confirm'
          type='password'
          autoComplete='new-password'
          maxLength={128}
          required
          aria-invalid={fieldError.confirm ? true : undefined}
          aria-describedby={fieldError.confirm ? 'join-confirm-error' : undefined}
        />
        {fieldError.confirm && (
          <span
            id='join-confirm-error'
            className='text-sm font-normal text-destructive'>
            {fieldError.confirm}
          </span>
        )}
      </label>
      {error && <ErrorNote message={error} />}
      <Button
        type='submit'
        size='lg'
        disabled={pending}>
        {pending && (
          <Loader2
            aria-hidden
            className='animate-spin'
          />
        )}
        {pending ? 'Creating your account…' : 'Create account and join'}
      </Button>
    </form>
  );
}

/** Signed in with the invited address: one click to become an agent. */
export function JoinAccept({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className='flex flex-col gap-3'>
      {error && <ErrorNote message={error} />}
      <Button
        size='lg'
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              const result = await acceptInvite(token);
              if (!result.ok) return setError(result.error);
              router.replace('/agent?welcome=1');
              router.refresh();
            } catch {
              setError('Check your connection and try again.');
            }
          })
        }>
        {pending ? 'Joining…' : 'Join as an agent'}
      </Button>
    </div>
  );
}

export function JoinSignOut() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size='lg'
      variant='outline'
      disabled={pending}
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.refresh();
        })
      }>
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
