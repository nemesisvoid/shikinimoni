'use client';

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { removeAgentPhoto, requestAgentPhotoUpload, saveAgentPhoto, updateAgentPhone, type PhoneState } from '@/actions/agent-profile.action';
import { AdminField, FormAlert } from '@/components/admin/form-field';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { initialsFor } from '@/lib/format';
import { AGENT_PHOTO_TYPES, MAX_AGENT_PHOTO_BYTES } from '@/schemas/agent.schema';

/** The agent's photo: pick a file, it uploads straight to storage, then replaces the old one. */
export function AgentPhotoForm({ photoUrl, name, email }: { photoUrl: string | null; name: string; email: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(photoUrl);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!(AGENT_PHOTO_TYPES as readonly string[]).includes(file.type)) return setError('Use a JPG, PNG or WebP image.');
    if (file.size > MAX_AGENT_PHOTO_BYTES) return setError('Use an image under 5 MB.');
    setBusy('upload');
    try {
      const ticket = await requestAgentPhotoUpload({ contentType: file.type, sizeBytes: file.size });
      if (!ticket.ok) return setError(ticket.error);
      const put = await fetch(ticket.data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!put.ok) return setError('The upload didn’t finish. Try again.');
      const saved = await saveAgentPhoto(ticket.data.key);
      if (!saved.ok) return setError(saved.error);
      setPreview(saved.data.url);
      toast.success('Photo saved.');
      router.refresh();
    } catch {
      setError('The upload didn’t finish. Check your connection and try again.');
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setError(null);
    setBusy('remove');
    try {
      const result = await removeAgentPhoto();
      if (!result.ok) return setError(result.error);
      setPreview(null);
      toast.success('Photo removed.');
      router.refresh();
    } catch {
      setError('That didn’t work. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className='flex flex-col gap-3 px-5 pb-5'>
      <div className='flex items-center gap-4'>
        <Avatar className='size-20 rounded-2xl'>
          {preview && (
            <AvatarImage
              src={preview}
              alt=''
              className='object-cover'
            />
          )}
          <AvatarFallback className='rounded-2xl bg-plum-100 text-lg font-semibold text-plum-900'>{initialsFor(name, email)}</AvatarFallback>
        </Avatar>
        <div className='flex flex-wrap gap-2'>
          <input
            ref={input}
            type='file'
            accept={AGENT_PHOTO_TYPES.join(',')}
            className='sr-only'
            id='agent-photo'
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button
            type='button'
            variant='outline'
            disabled={busy !== null}
            onClick={() => input.current?.click()}>
            {busy === 'upload' ? (
              <Loader2
                aria-hidden
                className='animate-spin'
              />
            ) : (
              <Camera aria-hidden />
            )}
            {busy === 'upload' ? 'Uploading…' : preview ? 'Change photo' : 'Add a photo'}
          </Button>
          {preview && (
            <Button
              type='button'
              variant='ghost'
              disabled={busy !== null}
              onClick={remove}>
              <Trash2 aria-hidden />
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className='text-xs text-muted-foreground'>A clear photo of your face. JPG, PNG or WebP, under 5 MB.</p>
      {error && <FormAlert message={error} />}
    </div>
  );
}

/** Phone for the team only. Submitted by hand so React doesn't reset the field. */
export function AgentPhoneForm({ phone }: { phone: string | null }) {
  const [state, dispatch, pending] = useActionState<PhoneState, FormData>(updateAgentPhone, { status: 'idle' });
  const [value, setValue] = useState(phone ?? '');
  const [, startRefresh] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'saved') {
      toast.success(state.message);
      startRefresh(() => router.refresh());
    }
  }, [state, router]);

  const error = state.status === 'error' ? state.fieldErrors.phone : undefined;
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
        id='agent-phone'
        label='Phone'
        optional
        hint='For the ShikiniMoni team only. It’s never shown on the site.'
        error={error}>
        {field => (
          <Input
            {...field}
            name='phone'
            type='tel'
            autoComplete='tel'
            maxLength={40}
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        )}
      </AdminField>
      {state.status === 'error' && !error && <FormAlert message={state.message} />}
      <div>
        <Button
          type='submit'
          disabled={pending || value.trim() === (phone ?? '')}>
          {pending ? 'Saving…' : 'Save phone'}
        </Button>
      </div>
    </form>
  );
}
