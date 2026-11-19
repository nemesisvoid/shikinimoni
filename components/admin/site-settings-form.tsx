'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { saveSiteSettings, type SiteSettingsState } from '@/actions/settings.action';
import { AdminField, FormAlert } from '@/components/admin/form-field';
import { AdminPanel } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { OpeningHours, SiteContact } from '@/lib/site';

const MAX_HOURS_ROWS = 7;

type Values = {
  contactEmail: string;
  phone: string;
  whatsapp: string;
  officeAddress: string;
  hours: OpeningHours[];
  replyTime: string;
  alertEmails: string;
};

const toValues = (c: SiteContact): Values => ({
  contactEmail: c.contactEmail,
  phone: c.phone,
  whatsapp: c.whatsapp,
  officeAddress: c.officeLines.join('\n'),
  hours: c.hours.length > 0 ? c.hours : [{ days: '', time: '' }],
  replyTime: c.replyTime,
  alertEmails: c.alertEmails.join(', '),
});

/** Compared field by field, ignoring blank hours rows and stray spaces. */
const comparable = (v: Values) =>
  JSON.stringify({
    ...v,
    officeAddress: v.officeAddress
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean),
    hours: v.hours.filter(h => h.days.trim() || h.time.trim()).map(h => [h.days.trim(), h.time.trim()]),
    alertEmails: v.alertEmails
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map(e => e.toLowerCase()),
    contactEmail: v.contactEmail.trim().toLowerCase(),
    phone: v.phone.trim(),
    whatsapp: v.whatsapp.trim(),
    replyTime: v.replyTime.trim(),
  });

/**
 * Contact details, office hours and enquiry alerts. Submitted by hand so React
 * doesn't reset the fields after a save or an error.
 */
export function SiteSettingsForm({ contact, envAlertFallback }: { contact: SiteContact; envAlertFallback: string | null }) {
  const [state, dispatch, pending] = useActionState<SiteSettingsState, FormData>(saveSiteSettings, { status: 'idle' });
  const [values, setValues] = useState(() => toValues(contact));
  const saved = toValues(contact);

  // After a save, show what was stored (tidied by the server, e.g. "We reply" dropped).
  // The new `contact` arrives with the action result; adjusting state during render.
  const [handledSave, setHandledSave] = useState(0);
  if (state.status === 'saved' && state.savedAt !== handledSave) {
    setHandledSave(state.savedAt);
    setValues(saved);
  }

  useEffect(() => {
    if (state.status === 'saved') toast.success(state.message);
  }, [state]);

  const errors = state.status === 'error' ? state.fieldErrors : {};
  const dirty = comparable(values) !== comparable(saved);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues(v => ({ ...v, [key]: value }));
  const setHour = (i: number, patch: Partial<OpeningHours>) =>
    set(
      'hours',
      values.hours.map((h, j) => (j === i ? { ...h, ...patch } : h)),
    );

  const replyPreview = values.replyTime.trim().replace(/^we reply\s+/i, '').replace(/\.$/, '');
  const alertsGoTo = values.alertEmails.trim()
    ? null
    : (envAlertFallback ?? (values.contactEmail.trim() || 'the contact email'));

  return (
    <form
      noValidate
      className='flex flex-col gap-6'
      onSubmit={event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => dispatch(formData));
      }}>
      <div className='grid items-start gap-6 xl:grid-cols-2'>
        <AdminPanel
          title='How people reach you'
          description='On the contact page, every listing and the emails visitors get.'>
          <div className='flex flex-col gap-4 px-5 pb-5'>
            <AdminField
              id='settings-email'
              label='Contact email'
              error={errors.contactEmail}>
              {field => (
                <Input
                  {...field}
                  name='contactEmail'
                  type='email'
                  autoComplete='off'
                  maxLength={254}
                  value={values.contactEmail}
                  onChange={e => set('contactEmail', e.target.value)}
                />
              )}
            </AdminField>
            <div className='grid gap-4 sm:grid-cols-2'>
              <AdminField
                id='settings-phone'
                label='Phone'
                hint='As it should appear, e.g. +234 803 123 4567'
                error={errors.phone}>
                {field => (
                  <Input
                    {...field}
                    name='phone'
                    type='tel'
                    maxLength={40}
                    value={values.phone}
                    onChange={e => set('phone', e.target.value)}
                  />
                )}
              </AdminField>
              <AdminField
                id='settings-whatsapp'
                label='WhatsApp number'
                hint='Can be the same as the phone'
                error={errors.whatsapp}>
                {field => (
                  <Input
                    {...field}
                    name='whatsapp'
                    type='tel'
                    maxLength={40}
                    value={values.whatsapp}
                    onChange={e => set('whatsapp', e.target.value)}
                  />
                )}
              </AdminField>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          title='Replies and alerts'
          description='What visitors are promised, and who hears about new enquiries.'>
          <div className='flex flex-col gap-4 px-5 pb-5'>
            <AdminField
              id='settings-reply'
              label='How soon you reply'
              hint={replyPreview ? <>Visitors read: “We reply {replyPreview}.”</> : 'Finishes the sentence “We reply …”'}
              error={errors.replyTime}>
              {field => (
                <Input
                  {...field}
                  name='replyTime'
                  maxLength={60}
                  placeholder='within one working day'
                  value={values.replyTime}
                  onChange={e => set('replyTime', e.target.value)}
                />
              )}
            </AdminField>
            <AdminField
              id='settings-alerts'
              label='Enquiry alerts go to'
              optional
              hint={
                alertsGoTo ? `Empty, so alerts go to ${alertsGoTo}. Add addresses to send them elsewhere.` : 'Separate addresses with commas.'
              }
              error={errors.alertEmails}>
              {field => (
                <Textarea
                  {...field}
                  name='alertEmails'
                  rows={2}
                  maxLength={1000}
                  placeholder='sales@shikinimoni.com, ada@shikinimoni.com'
                  value={values.alertEmails}
                  onChange={e => set('alertEmails', e.target.value)}
                />
              )}
            </AdminField>
          </div>
        </AdminPanel>

        <AdminPanel
          title='Office'
          description='Shown on the contact page, with a Google Maps link, and at the foot of every email.'
          className='xl:col-span-2'>
          <div className='grid gap-6 px-5 pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]'>
            <AdminField
              id='settings-address'
              label='Address'
              hint='One line per row, up to 4 rows'
              error={errors.officeAddress}>
              {field => (
                <Textarea
                  {...field}
                  name='officeAddress'
                  rows={4}
                  maxLength={300}
                  value={values.officeAddress}
                  onChange={e => set('officeAddress', e.target.value)}
                />
              )}
            </AdminField>

            <fieldset aria-describedby={errors.hours ? 'settings-hours-error' : 'settings-hours-hint'}>
              <legend className='mb-1.5 text-sm font-medium'>Opening hours</legend>
              <div className='flex flex-col gap-2'>
                {values.hours.map((h, i) => (
                  <div
                    key={i}
                    className='grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2'>
                    <Input
                      name='hoursDays'
                      aria-label={`Days, row ${i + 1}`}
                      placeholder='Monday to Friday'
                      maxLength={40}
                      value={h.days}
                      onChange={e => setHour(i, { days: e.target.value })}
                    />
                    <Input
                      name='hoursTime'
                      aria-label={`Times, row ${i + 1}`}
                      placeholder='9am to 6pm'
                      maxLength={40}
                      value={h.time}
                      onChange={e => setHour(i, { time: e.target.value })}
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-label={`Remove row ${i + 1}`}
                      disabled={values.hours.length === 1}
                      onClick={() =>
                        set(
                          'hours',
                          values.hours.filter((_, j) => j !== i),
                        )
                      }>
                      <X aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
              {errors.hours ? (
                <p
                  id='settings-hours-error'
                  className='mt-1.5 text-sm text-destructive'>
                  {errors.hours}
                </p>
              ) : (
                <p
                  id='settings-hours-hint'
                  className='mt-1.5 text-xs text-muted-foreground'>
                  Leave a day out to show it as closed.
                </p>
              )}
              {values.hours.length < MAX_HOURS_ROWS && (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='mt-3'
                  onClick={() => set('hours', [...values.hours, { days: '', time: '' }])}>
                  <Plus aria-hidden />
                  Add a row
                </Button>
              )}
            </fieldset>
          </div>
        </AdminPanel>
      </div>

      {state.status === 'error' && <FormAlert message={state.message} />}

      <div className='sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8'>
        <Button
          type='submit'
          disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
        {dirty && !pending && (
          <>
            <span className='text-xs text-muted-foreground'>Unsaved changes</span>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => setValues(saved)}>
              Discard
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
