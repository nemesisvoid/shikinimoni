'use client';

import { useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { setShowAgentsOnListings } from '@/actions/settings.action';
import { AdminPanel } from '@/components/admin/page-header';
import { Switch } from '@/components/ui/switch';

/** Site-wide "Listed by" switch. Saves on its own, separately from the contact form. */
export function ListedBySwitch({ initial, agentCount }: { initial: boolean; agentCount: number }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const id = useId();
  return (
    <div id='listed-by'>
      <AdminPanel
        title='Agents on listings'
        description='When this is on, an agent’s listings show “Listed by” with their name and photo. Calls, WhatsApp and enquiries still come to your team.'>
        <div className='flex flex-col gap-2 px-5 pb-5'>
          <div className='flex items-center gap-3'>
            <Switch
              id={id}
              checked={on}
              disabled={pending}
              onCheckedChange={checked =>
                start(async () => {
                  setOn(checked);
                  try {
                    const result = await setShowAgentsOnListings(checked);
                    if (result.ok) toast.success(result.message);
                    else {
                      setOn(!checked);
                      toast.error(result.error);
                    }
                  } catch {
                    setOn(!checked);
                    toast.error('Your session may have ended. Sign in again and retry.');
                  }
                })
              }
            />
            <label
              htmlFor={id}
              className='text-sm font-medium'>
              Show the agent on their listings
            </label>
          </div>
          <p className='text-xs text-muted-foreground'>
            Agents without a photo aren’t shown. You can hide individual agents on the{' '}
            <Link
              href='/admin/agents'
              className='underline underline-offset-4'>
              Agents page
            </Link>
            {agentCount ? ` (${agentCount} now)` : ''}.
          </p>
        </div>
      </AdminPanel>
    </div>
  );
}
