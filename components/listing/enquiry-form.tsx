'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { CalendarCheck, CircleCheck, Loader2, MessageCircleQuestion } from 'lucide-react';
import { sendPropertyEnquiry, type EnquiryFormState } from '@/actions/inquiry.action';
import { FieldMessage, TextInput } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { addDays, ENQUIRY_INTENTS, lagosToday, MAX_VIEWING_DAYS_AHEAD, type EnquiryIntent } from '@/schemas/inquiry.schema';

const INTENT_ICONS: Record<EnquiryIntent, React.ReactNode> = {
  viewing: <CalendarCheck />,
  question: <MessageCircleQuestion />,
};

const FIELD_ORDER = ['intent', 'name', 'email', 'phone', 'preferredDate', 'message'] as const;

const longDate = new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const formatDay = (iso: string) => longDate.format(new Date(`${iso}T12:00:00Z`));

/** Remounts the form for "Send another", which clears useActionState. */
export function EnquiryForm(props: { propertyId: string; closed: boolean; replyTime: string }) {
  const [round, setRound] = useState(0);
  return (
    <EnquiryFormInner
      key={round}
      {...props}
      onReset={() => setRound(r => r + 1)}
    />
  );
}

function EnquiryFormInner({
  propertyId,
  closed,
  replyTime,
  onReset,
}: {
  propertyId: string;
  closed: boolean;
  replyTime: string;
  onReset: () => void;
}) {
  const [state, formAction, isPending] = useActionState<EnquiryFormState, FormData>(sendPropertyEnquiry, { status: 'idle' });
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef<HTMLHeadingElement>(null);

  const values = state.status === 'error' ? state.values : {};
  const errors = state.status === 'error' ? state.fieldErrors : {};
  // Uncontrolled radios: React resets the form after each submit and the reset
  // restores defaultChecked (what the server sent back). `intent` mirrors it.
  const fallback: EnquiryIntent = closed ? 'question' : 'viewing';
  const checkedIntent: EnquiryIntent = values.intent === 'viewing' || values.intent === 'question' ? values.intent : fallback;
  const [intent, setIntent] = useState<EnquiryIntent>(checkedIntent);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setIntent(checkedIntent);
  }
  const viewing = intent === 'viewing';

  // The calendar's range depends on today's date, so set it in the browser.
  useEffect(() => {
    const input = dateRef.current;
    if (!input) return;
    const today = lagosToday();
    input.min = today;
    input.max = addDays(today, MAX_VIEWING_DAYS_AHEAD);
  });

  useEffect(() => {
    if (state.status === 'sent') sentRef.current?.focus();
    if (state.status === 'error') {
      const first = FIELD_ORDER.find(name => errors[name]);
      const el = first && formRef.current?.querySelector<HTMLElement>(first === 'intent' ? '[name="intent"]' : `#${id}-${first}`);
      el?.focus();
    }
    // Only when a new result arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (state.status === 'sent') {
    const isViewing = state.intent === 'viewing';
    return (
      <div className='flex flex-col items-start gap-4 py-2'>
        <span
          aria-hidden
          className='grid size-12 place-items-center bg-plum-800 pt-2.5 text-white [clip-path:var(--clip-house)]'>
          <CircleCheck className='size-5' />
        </span>
        <h3
          ref={sentRef}
          tabIndex={-1}
          className='text-h3 outline-none'>
          {isViewing ? 'Inspection request sent' : 'Question sent'}
        </h3>
        <p className='text-sm text-muted-foreground'>
          Thanks, {state.name}.{' '}
          {isViewing
            ? `We'll call you to confirm a time${state.preferredDate ? ` close to ${formatDay(state.preferredDate)}` : ''}.`
            : `We'll reply to ${state.email} ${replyTime}.`}
        </p>
        <Button
          type='button'
          variant='outline'
          onClick={onReset}>
          Send another
        </Button>
      </div>
    );
  }

  const describedBy = (name: string) => (errors[name as keyof typeof errors] ? `${id}-${name}-error` : undefined);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-describedby={state.status === 'error' ? `${id}-summary` : undefined}
      className='flex flex-col gap-5'>
      <input
        type='hidden'
        name='propertyId'
        value={propertyId}
      />

      <fieldset aria-describedby={describedBy('intent')}>
        <legend className='sr-only'>What would you like to do?</legend>
        <div className='grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1'>
          {(Object.keys(ENQUIRY_INTENTS) as EnquiryIntent[]).map(key => (
            <label
              key={key}
              className='relative cursor-pointer'>
              <input
                type='radio'
                name='intent'
                value={key}
                defaultChecked={checkedIntent === key}
                onChange={() => setIntent(key)}
                className='peer sr-only'
              />
              <span className='flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold text-muted-foreground transition-[background-color,color,box-shadow] duration-200 ease-out-soft peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40 hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0'>
                {INTENT_ICONS[key]}
                {key === 'viewing' ? 'Inspect' : 'Ask'}
                <span className='sr-only'>{ENQUIRY_INTENTS[key]}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldMessage
          id={`${id}-intent-error`}
          error={errors.intent}
        />
      </fieldset>

      <TextInput
        id={`${id}-name`}
        name='name'
        label='Your name'
        autoComplete='name'
        defaultValue={values.name ?? ''}
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
        defaultValue={values.email ?? ''}
        error={errors.email}
        describedBy={describedBy('email')}
        maxLength={254}
      />
      <TextInput
        id={`${id}-phone`}
        name='phone'
        type='tel'
        label='Phone or WhatsApp'
        optional={!viewing}
        autoComplete='tel'
        inputMode='tel'
        placeholder='e.g. 0803 123 4567'
        defaultValue={values.phone ?? ''}
        error={errors.phone}
        describedBy={describedBy('phone')}
        maxLength={30}
      />

      {/* Stays in the form when hidden; the server ignores it for questions. */}
      <div
        hidden={!viewing}
        className='flex flex-col gap-2'>
        <label
          htmlFor={`${id}-preferredDate`}
          className='text-sm font-semibold'>
          Preferred day <span className='ml-1 font-normal text-muted-foreground'>(optional)</span>
        </label>
        <input
          ref={dateRef}
          id={`${id}-preferredDate`}
          name='preferredDate'
          type='date'
          defaultValue={values.preferredDate ?? ''}
          aria-invalid={Boolean(errors.preferredDate)}
          aria-describedby={describedBy('preferredDate')}
          className='h-12 w-full rounded-3xl border border-input bg-ink-50 px-4 text-base outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20'
        />
        <FieldMessage
          id={`${id}-preferredDate-error`}
          error={errors.preferredDate}
        />
      </div>

      <div className='flex flex-col gap-2'>
        <label
          htmlFor={`${id}-message`}
          className='text-sm font-semibold'>
          {viewing ? 'Anything we should know?' : 'Your question'}
          {viewing && <span className='ml-1.5 font-normal text-muted-foreground'>(optional)</span>}
        </label>
        <Textarea
          id={`${id}-message`}
          name='message'
          defaultValue={values.message ?? ''}
          placeholder={
            viewing ? 'e.g. I can only make weekend mornings.' : 'e.g. Is the price negotiable? Can I see the survey plan first?'
          }
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy('message')}
          maxLength={5000}
          className='min-h-24 bg-ink-50 px-4 py-3'
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

      <Button
        type='submit'
        size='lg'
        disabled={isPending}
        className='h-12 w-full text-base'>
        {isPending && (
          <Loader2
            aria-hidden
            className='animate-spin'
          />
        )}
        {isPending ? 'Sending…' : viewing ? 'Request an inspection' : 'Send question'}
      </Button>
      <p className={cn('-mt-2 text-center text-xs text-muted-foreground')}>
        {viewing ? 'We call to confirm the time before anyone travels.' : `We reply ${replyTime}.`}
      </p>

      {state.status === 'error' && (
        <p
          id={`${id}-summary`}
          role='alert'
          className='-mt-1 rounded-xl bg-destructive/10 p-3 text-sm text-destructive'>
          {state.message}
        </p>
      )}
    </form>
  );
}
