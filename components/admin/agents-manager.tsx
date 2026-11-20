'use client';

import { useActionState, useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Copy, MailPlus, MoreHorizontal, RefreshCw, UserMinus, X } from 'lucide-react';
import {
  cancelInvite,
  inviteAgent,
  removeAgent,
  resendInvite,
  setAgentStatus,
  setAgentVisibility,
  type AgentActionResult,
  type InviteAgentState,
} from '@/actions/agent-admin.action';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { initialsFor } from '@/lib/format';

export type AgentRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  showOnListings: boolean;
  joined: string;
  listings: { live: number; pending: number; drafts: number };
};
export type InviteRow = { id: string; name: string; email: string; expires: string; expired: boolean; invitedBy: string };

const SESSION_ENDED = 'Your session may have ended. Sign in again and retry.';

export function AgentsManager({ agents, invites, showAgentsSiteWide }: { agents: AgentRow[]; invites: InviteRow[]; showAgentsSiteWide: boolean }) {
  return (
    <div className='grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]'>
      <AdminPanel
        title='Agents'
        description={
          showAgentsSiteWide
            ? '“Listed by” is on for the site. Use each agent’s switch to hide them.'
            : '“Listed by” is off for the whole site (Site settings), so no agent shows on listings yet.'
        }
        action={
          <Link
            href='/admin/settings#listed-by'
            className='shrink-0 text-sm font-medium text-primary hover:underline'>
            Site setting
          </Link>
        }>
        {agents.length === 0 ? (
          <p className='border-t px-5 py-5 text-sm text-muted-foreground'>No agents yet. Invite one with the form.</p>
        ) : (
          <ul className='divide-y border-t'>
            {agents.map(agent => (
              <AgentItem
                key={agent.id}
                agent={agent}
                siteWide={showAgentsSiteWide}
              />
            ))}
          </ul>
        )}
      </AdminPanel>

      <div className='flex flex-col gap-6'>
        <AdminPanel
          title='Invite an agent'
          description='They get a personal link to create their account. It works once, for this email only, for 7 days.'>
          <InviteForm />
        </AdminPanel>
        {invites.length > 0 && (
          <AdminPanel
            title='Waiting to join'
            description='Invites that haven’t been used yet.'>
            <ul className='divide-y border-t'>
              {invites.map(invite => (
                <InviteItem
                  key={invite.id}
                  invite={invite}
                />
              ))}
            </ul>
          </AdminPanel>
        )}
      </div>
    </div>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<AgentActionResult>, after?: (r: Extract<AgentActionResult, { ok: true }>) => void) =>
    start(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          after?.(result);
          router.refresh();
        } else toast.error(result.error);
      } catch {
        toast.error(SESSION_ENDED);
      }
    });
  return { pending, run };
}

function AgentItem({ agent, siteWide }: { agent: AgentRow; siteWide: boolean }) {
  const { pending, run } = useRun();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const label = agent.name || agent.email;
  const switchId = useId();
  const total = agent.listings.live + agent.listings.pending + agent.listings.drafts;
  const counts = [
    agent.listings.live && `${agent.listings.live} live`,
    agent.listings.pending && `${agent.listings.pending} in review`,
    agent.listings.drafts && `${agent.listings.drafts} draft${agent.listings.drafts === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const missing = !agent.photoUrl || !agent.name;

  return (
    <li className='flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center'>
      <div className='flex min-w-0 flex-1 items-center gap-3'>
        <Avatar className='size-10 rounded-xl'>
          {agent.photoUrl && (
            <AvatarImage
              src={agent.photoUrl}
              alt=''
              className='object-cover'
            />
          )}
          <AvatarFallback className='rounded-xl bg-plum-100 text-xs font-semibold text-plum-900'>{initialsFor(agent.name, agent.email)}</AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1'>
          <p className='flex flex-wrap items-center gap-2 text-sm font-medium'>
            <span className='truncate'>{agent.name || 'No name yet'}</span>
            {agent.status === 'SUSPENDED' && (
              <span className='rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive'>Suspended</span>
            )}
          </p>
          <p className='truncate text-xs text-muted-foreground'>
            {[agent.email, agent.phone, `joined ${agent.joined}`].filter(Boolean).join(' · ')}
          </p>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            {total ? (
              <Link
                href={`/admin/properties?agent=${agent.id}`}
                className='underline decoration-border underline-offset-4 hover:text-foreground'>
                {counts.join(', ')}
              </Link>
            ) : (
              'No listings yet'
            )}
          </p>
        </div>
      </div>

      <div className='flex shrink-0 items-center justify-between gap-3 sm:justify-end'>
        <div className='flex items-center gap-2'>
          <Switch
            id={switchId}
            checked={agent.showOnListings}
            disabled={pending}
            onCheckedChange={checked => run(() => setAgentVisibility(agent.id, checked))}
          />
          <label
            htmlFor={switchId}
            className='text-sm'>
            Listed by
            <span className='block text-xs text-muted-foreground'>
              {!agent.showOnListings ? 'Hidden' : !siteWide ? 'Off site-wide' : missing ? 'Needs a photo' : 'Shown'}
            </span>
          </label>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon'
                aria-label={`More for ${label}`}
              />
            }>
            <MoreHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='end'
            className='min-w-52'>
            <DropdownMenuItem render={<Link href={`/admin/properties?agent=${agent.id}`} />}>Their listings</DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/admin/activity?who=${agent.id}`} />}>Their activity</DropdownMenuItem>
            <DropdownMenuSeparator />
            {agent.status === 'ACTIVE' ? (
              <DropdownMenuItem onClick={() => run(() => setAgentStatus(agent.id, 'SUSPENDED'))}>Suspend</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => run(() => setAgentStatus(agent.id, 'ACTIVE'))}>Reactivate</DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant='destructive'
              onClick={() => setConfirmRemove(true)}>
              <UserMinus />
              Remove agent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog
        open={confirmRemove}
        onOpenChange={open => !open && !pending && setConfirmRemove(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {label} as an agent?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose the agent area straight away. Their account stays, so they can still sign in to the site.{' '}
              {total ? `Their ${total} listing${total === 1 ? '' : 's'} become company listings; live ones stay live.` : ''} To pause them instead, use
              Suspend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep them</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={pending}
              onClick={() => run(() => removeAgent(agent.id), () => setConfirmRemove(false))}>
              {pending ? 'Removing…' : 'Remove agent'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function InviteItem({ invite }: { invite: InviteRow }) {
  const { pending, run } = useRun();
  const [link, setLink] = useState<string | null>(null);
  return (
    <li className='flex flex-col gap-2 px-5 py-3.5'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{invite.name}</p>
          <p className='truncate text-xs text-muted-foreground'>{invite.email}</p>
          <p className={invite.expired ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
            {invite.expired ? `Expired ${invite.expires}` : `Expires ${invite.expires}`} · from {invite.invitedBy}
          </p>
        </div>
        <div className='flex shrink-0 gap-1'>
          <Button
            variant='ghost'
            size='sm'
            disabled={pending}
            onClick={() => run(() => resendInvite(invite.id), r => r.link && setLink(r.link))}>
            <RefreshCw aria-hidden />
            {invite.expired ? 'Renew' : 'Resend'}
          </Button>
          <Button
            variant='ghost'
            size='icon'
            aria-label={`Cancel the invite for ${invite.email}`}
            disabled={pending}
            onClick={() => run(() => cancelInvite(invite.id))}>
            <X aria-hidden />
          </Button>
        </div>
      </div>
      {link && <CopyLink url={link} />}
    </li>
  );
}

function InviteForm() {
  const [state, formAction, pending] = useActionState(
    async (prev: InviteAgentState, formData: FormData) => {
      try {
        const next = await inviteAgent(prev, formData);
        if (next.status === 'saved') (next.emailed ? toast.success : toast.message)(next.message);
        return next;
      } catch {
        toast.error(SESSION_ENDED);
        return prev;
      }
    },
    { status: 'idle' } as InviteAgentState,
  );
  const id = useId();
  const errors = state.status === 'error' ? state.fieldErrors : {};
  const values = state.status === 'error' ? state.values : { name: '', email: '' };
  const formKey = state.status === 'saved' ? `saved-${state.savedAt}` : state.status === 'error' ? `error-${values.email}-${values.name}` : 'fresh';

  return (
    <div className='flex flex-col gap-4 px-5 pb-5'>
      <form
        key={formKey}
        action={formAction}
        noValidate
        className='flex flex-col gap-3'>
        <label
          htmlFor={`${id}-name`}
          className='flex flex-col gap-1.5 text-sm font-medium'>
          Their name
          <Input
            id={`${id}-name`}
            name='name'
            autoComplete='off'
            maxLength={120}
            defaultValue={values.name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
          />
          {errors.name && (
            <span
              id={`${id}-name-error`}
              className='text-sm font-normal text-destructive'>
              {errors.name}
            </span>
          )}
        </label>
        <label
          htmlFor={`${id}-email`}
          className='flex flex-col gap-1.5 text-sm font-medium'>
          Their email
          <Input
            id={`${id}-email`}
            name='email'
            type='email'
            autoComplete='off'
            maxLength={254}
            placeholder='name@example.com'
            defaultValue={values.email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${id}-email-error` : undefined}
          />
          {errors.email && (
            <span
              id={`${id}-email-error`}
              className='text-sm font-normal text-destructive'>
              {errors.email}
            </span>
          )}
        </label>
        {state.status === 'error' && !errors.name && !errors.email && (
          <p
            role='alert'
            className='text-sm text-destructive'>
            {state.message}
          </p>
        )}
        <Button
          type='submit'
          disabled={pending}>
          <MailPlus aria-hidden />
          {pending ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
      {state.status === 'saved' && (
        <div className='flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm'>
          <p>{state.emailed ? 'You can also send them this link on WhatsApp:' : 'Send them this link:'}</p>
          <CopyLink url={state.link} />
        </div>
      )}
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className='flex items-center gap-2 rounded-xl border bg-background py-1 pr-1 pl-3'>
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
