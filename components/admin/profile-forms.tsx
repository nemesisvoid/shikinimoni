'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { changePassword, updateProfile, type PasswordState, type ProfileState } from '@/actions/account.action';
import { AdminField, FormAlert } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Your name. Submitted by hand so React doesn't reset the field. */
export function ProfileNameForm({ name }: { name: string }) {
  const [state, dispatch, pending] = useActionState<ProfileState, FormData>(updateProfile, { status: 'idle' });
  const [value, setValue] = useState(name);

  useEffect(() => {
    if (state.status === 'saved') toast.success(state.message);
  }, [state]);

  const dirty = value.trim() !== name;
  const error = state.status === 'error' ? state.fieldErrors.name : undefined;

  return (
    <form
      noValidate
      className='flex flex-col gap-4 px-5 pb-5'
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}>
      <AdminField
        id='profile-name'
        label='Name'
        hint='Shown in this admin and on enquiries you handle. Visitors never see it.'
        error={error}>
        {field => (
          <Input
            {...field}
            name='name'
            autoComplete='name'
            maxLength={80}
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        )}
      </AdminField>
      {state.status === 'error' && !error && <FormAlert message={state.message} />}
      <div>
        <Button
          type='submit'
          disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save name'}
        </Button>
      </div>
    </form>
  );
}

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** Change password. The fields clear after a successful change. */
export function ChangePasswordForm({ email }: { email: string }) {
  const [state, dispatch, pending] = useActionState<PasswordState, FormData>(changePassword, { status: 'idle' });
  const [values, setValues] = useState(EMPTY);
  const [show, setShow] = useState(false);

  // Clear the fields once a change comes back (adjusting state during render, not in an effect).
  const [handledSave, setHandledSave] = useState(0);
  if (state.status === 'saved' && state.savedAt !== handledSave) {
    setHandledSave(state.savedAt);
    setValues(EMPTY);
    setShow(false);
  }

  useEffect(() => {
    if (state.status === 'saved') toast.success(state.message);
  }, [state]);

  const errors = state.status === 'error' ? state.fieldErrors : {};
  const hasFieldErrors = Object.values(errors).some(Boolean);
  const type = show ? 'text' : 'password';
  const field = (key: keyof typeof EMPTY) => ({
    name: key,
    type,
    value: values[key],
    maxLength: 128,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues(v => ({ ...v, [key]: e.target.value })),
  });

  return (
    <form
      noValidate
      className='flex flex-col gap-4 px-5 pb-5'
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}>
      {/* Lets password managers file the new password under the right account. */}
      <input
        type='email'
        name='username'
        autoComplete='username'
        value={email}
        readOnly
        hidden
      />
      <AdminField
        id='password-current'
        label='Current password'
        error={errors.currentPassword}>
        {a11y => (
          <Input
            {...a11y}
            {...field('currentPassword')}
            autoComplete='current-password'
          />
        )}
      </AdminField>
      <div className='grid gap-4 sm:grid-cols-2'>
        <AdminField
          id='password-new'
          label='New password'
          hint='At least 8 characters'
          error={errors.newPassword}>
          {a11y => (
            <Input
              {...a11y}
              {...field('newPassword')}
              autoComplete='new-password'
            />
          )}
        </AdminField>
        <AdminField
          id='password-confirm'
          label='New password again'
          error={errors.confirmPassword}>
          {a11y => (
            <Input
              {...a11y}
              {...field('confirmPassword')}
              autoComplete='new-password'
            />
          )}
        </AdminField>
      </div>

      <div className='flex flex-col gap-2 text-sm'>
        <label className='flex cursor-pointer items-center gap-2.5'>
          <input
            type='checkbox'
            checked={show}
            onChange={e => setShow(e.target.checked)}
            className='size-4 accent-primary'
          />
          Show passwords
        </label>
        <label className='flex cursor-pointer items-start gap-2.5'>
          {/* Unchecked boxes send nothing; this hidden value makes that an explicit "false". */}
          <input
            type='hidden'
            name='signOutOthers'
            value='false'
          />
          <input
            type='checkbox'
            name='signOutOthers'
            defaultChecked
            className='mt-0.5 size-4 accent-primary'
          />
          <span>
            Sign out my other devices
            <span className='block text-xs text-muted-foreground'>You stay signed in here.</span>
          </span>
        </label>
      </div>

      {state.status === 'error' && !hasFieldErrors && <FormAlert message={state.message} />}
      <div>
        <Button
          type='submit'
          disabled={pending || !values.currentPassword || !values.newPassword || !values.confirmPassword}>
          {pending ? 'Changing…' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}
