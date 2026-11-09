'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { CircleCheck, House, KeyRound, Loader2, MessagesSquare, Signpost } from 'lucide-react';
import { sendContactMessage, type ContactFormState } from '@/actions/contact.action';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { digitsOnly, siteConfig } from '@/lib/site';
import { CONTACT_TOPICS, isContactTopic, type ContactTopic } from '@/schemas/inquiry.schema';

const TOPIC_ICONS: Record<ContactTopic, React.ReactNode> = {
  buying: <House />,
  renting: <KeyRound />,
  selling: <Signpost />,
  other: <MessagesSquare />,
};

/** Short labels for the tiles; the stored message uses the longer CONTACT_TOPICS text. */
const TOPIC_LABELS: Record<ContactTopic, string> = {
  buying: 'Buying',
  renting: 'Renting',
  selling: 'Selling',
  other: 'Something else',
};

const PLACEHOLDERS: Record<ContactTopic, string> = {
  buying: 'Which area, what budget, and land or a house? If you saw a listing, add its PRP reference.',
  renting: 'Which area, your yearly budget, and when you want to move in.',
  selling: 'Where the property is, what it is, and which title documents you have (C of O, survey plan…).',
  other: 'How can we help?',
};

const FIELD_ORDER = ['topic', 'name', 'email', 'phone', 'message'] as const;

export type ContactDefaults = { topic?: ContactTopic; name?: string; email?: string };

/** Remounts the form for "Send another message", which clears useActionState. */
export function ContactForm({ defaults = {} }: { defaults?: ContactDefaults }) {
  const [round, setRound] = useState(0);
  return (
    <ContactFormInner
      key={round}
      defaults={defaults}
      onReset={() => setRound(r => r + 1)}
    />
  );
}

function ContactFormInner({ defaults, onReset }: { defaults: ContactDefaults; onReset: () => void }) {
  const [state, formAction, isPending] = useActionState<ContactFormState, FormData>(sendContactMessage, { status: 'idle' });
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  const values = state.status === 'error' ? state.values : {};
  const errors = state.status === 'error' ? state.fieldErrors : {};
  // The radios are uncontrolled: React resets the form after each submit, and the
  // reset restores `defaultChecked`, which comes from what the server sent back.
  // `topic` mirrors the choice for the tile styling and the message placeholder.
  const checkedTopic = isContactTopic(values.topic) ? values.topic : defaults.topic || 'buying';
  const [topic, setTopic] = useState<ContactTopic>(checkedTopic);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setTopic(checkedTopic);
  }

  // After a submit: focus the first field that needs fixing, or the thank-you heading.
  useEffect(() => {
    if (state.status === 'sent') sentHeadingRef.current?.focus();
    if (state.status === 'error') {
      const first = FIELD_ORDER.find(name => errors[name]);
      const el = first && formRef.current?.querySelector<HTMLElement>(first === 'topic' ? `[name="topic"]` : `#${id}-${first}`);
      el?.focus();
    }
    // Only when a new result arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state.status === 'sent') {
    return (
      <div className='flex flex-col items-start gap-5 py-6'>
        <span
          aria-hidden
          className='grid size-14 place-items-center bg-plum-800 pt-3 text-white [clip-path:var(--clip-house)]'>
          <CircleCheck className='size-6' />
        </span>
        <div>
          <h2
            ref={sentHeadingRef}
            tabIndex={-1}
            className='text-h2 outline-none'>
            Thanks, {state.name}. Your message is with our team.
          </h2>
          <p className='mt-3 max-w-prose text-lead text-muted-foreground'>
            We&apos;ll reply to <span className='font-medium text-foreground'>{state.email}</span> {siteConfig.replyTime}. If
            it&apos;s urgent, call or WhatsApp us on{' '}
            <a
              href={`tel:+${digitsOnly(siteConfig.phone)}`}
              className='font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline'>
              {siteConfig.phone}
            </a>
            .
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Link
            href='/#listings'
            className={buttonVariants({ size: 'lg' })}>
            Browse listings
          </Link>
          <Button
            type='button'
            variant='ghost'
            size='lg'
            onClick={onReset}>
            Send another message
          </Button>
        </div>
      </div>
    );
  }

  const describedBy = (name: string, hint?: boolean) =>
    [errors[name as keyof typeof errors] ? `${id}-${name}-error` : null, hint ? `${id}-${name}-hint` : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-describedby={state.status === 'error' ? `${id}-summary` : undefined}
      className='flex flex-col gap-7'>
      {/* ── Topic ─────────────────────────────────────────────────────── */}
      <fieldset aria-describedby={describedBy('topic')}>
        <legend className='text-sm font-semibold'>What&apos;s it about?</legend>
        <div className='mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4'>
          {(Object.keys(CONTACT_TOPICS) as ContactTopic[]).map(key => (
            <label
              key={key}
              className='group relative cursor-pointer'>
              <input
                type='radio'
                name='topic'
                value={key}
                defaultChecked={checkedTopic === key}
                onChange={() => setTopic(key)}
                className='peer sr-only'
              />
              <span
                className={cn(
                  'flex h-full flex-col items-start gap-3 rounded-2xl border bg-background p-3.5 transition-[border-color,background-color,box-shadow] duration-200',
                  'group-hover:border-plum-300 peer-checked:border-plum-800 peer-checked:bg-plum-50 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40',
                )}>
                <span
                  aria-hidden
                  className={cn(
                    'grid size-9 place-items-center pt-1.5 transition-colors duration-200 [clip-path:var(--clip-house)] [&_svg]:size-4',
                    topic === key ? 'bg-plum-800 text-white' : 'bg-plum-100 text-plum-800',
                  )}>
                  {TOPIC_ICONS[key]}
                </span>
                <span className='text-sm font-semibold'>{TOPIC_LABELS[key]}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldMessage
          id={`${id}-topic-error`}
          error={errors.topic}
        />
      </fieldset>

      {/* ── You ───────────────────────────────────────────────────────── */}
      <div className='grid gap-5 sm:grid-cols-2'>
        <TextInput
          id={`${id}-name`}
          name='name'
          label='Your name'
          autoComplete='name'
          defaultValue={values.name ?? defaults.name ?? ''}
          error={errors.name}
          describedBy={describedBy('name')}
          maxLength={120}
        />
        <TextInput
          id={`${id}-email`}
          name='email'
          type='email'
          label='Email'
          autoComplete='email'
          defaultValue={values.email ?? defaults.email ?? ''}
          error={errors.email}
          describedBy={describedBy('email')}
          maxLength={254}
        />
      </div>
      <TextInput
        id={`${id}-phone`}
        name='phone'
        type='tel'
        label='Phone or WhatsApp'
        optional
        hint='Add it if you’d like an agent to call you back.'
        autoComplete='tel'
        inputMode='tel'
        placeholder='e.g. 0803 123 4567'
        defaultValue={values.phone ?? ''}
        error={errors.phone}
        describedBy={describedBy('phone', true)}
        maxLength={30}
        className='sm:max-w-[calc(50%-0.625rem)]'
      />

      {/* ── Message ───────────────────────────────────────────────────── */}
      <div className='flex flex-col gap-2'>
        <label
          htmlFor={`${id}-message`}
          className='text-sm font-semibold'>
          Message
        </label>
        <Textarea
          id={`${id}-message`}
          name='message'
          defaultValue={values.message ?? ''}
          placeholder={PLACEHOLDERS[topic]}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy('message')}
          maxLength={5000}
          className='min-h-40 bg-ink-50 px-4 py-3.5'
        />
        <FieldMessage
          id={`${id}-message-error`}
          error={errors.message}
        />
      </div>

      {/* People never see this; bots fill it in. */}
      <div
        aria-hidden
        className='absolute left-[-9999px] h-px w-px overflow-hidden'>
        <label>
          Company
          <input
            type='text'
            name='company'
            tabIndex={-1}
            autoComplete='off'
          />
        </label>
      </div>

      {/* ── Send ──────────────────────────────────────────────────────── */}
      <div className='flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between'>
        <p className='max-w-sm text-sm text-muted-foreground'>
          We reply {siteConfig.replyTime} and only use your details to answer you.
        </p>
        <Button
          type='submit'
          size='lg'
          disabled={isPending}
          className='h-12 px-7 text-base'>
          {isPending && (
            <Loader2
              aria-hidden
              className='animate-spin'
            />
          )}
          {isPending ? 'Sending…' : 'Send message'}
        </Button>
      </div>

      {state.status === 'error' && (
        <p
          id={`${id}-summary`}
          role='alert'
          className='-mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive'>
          {state.message}
        </p>
      )}
    </form>
  );
}

function TextInput({
  id,
  label,
  optional,
  hint,
  error,
  describedBy,
  className,
  ...props
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  describedBy?: string;
  className?: string;
} & Omit<React.ComponentProps<'input'>, 'id' | 'className'>) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label
        htmlFor={id}
        className='text-sm font-semibold'>
        {label}
        {optional && <span className='ml-1.5 font-normal text-muted-foreground'>(optional)</span>}
      </label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className='h-12 bg-ink-50 px-4'
        {...props}
      />
      {hint && !error && (
        <p
          id={`${id}-hint`}
          className='text-sm text-muted-foreground'>
          {hint}
        </p>
      )}
      <FieldMessage
        id={`${id}-error`}
        error={error}
      />
    </div>
  );
}

function FieldMessage({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p
      id={id}
      className='mt-1 text-sm text-destructive'>
      {error}
    </p>
  );
}
