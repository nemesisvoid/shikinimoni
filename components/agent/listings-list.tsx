import Image from 'next/image';
import { Building2, Eye } from 'lucide-react';
import { AgentListingActions, AgentListingPrimary } from '@/components/agent/listing-actions';
import { STAGE_META, StageBadge } from '@/components/agent/stage-badge';
import type { AgentListingRow } from '@/lib/agents/queries';
import { formatRelativeTime } from '@/lib/format';

/** The agent's listings as rows: photo, name, stage and next step, views, actions. */
export function AgentListingsList({ rows, showNote = true }: { rows: AgentListingRow[]; showNote?: boolean }) {
  return (
    <ul className='divide-y'>
      {rows.map(row => {
        const place = [row.neighborhood, row.city].filter(Boolean).join(', ');
        const cover = row.media[0];
        const live = row.stage.startsWith('live');
        return (
          <li
            key={row.id}
            className='flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center'>
            <div className='flex min-w-0 flex-1 items-start gap-3'>
              <div className='relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted'>
                {cover ? (
                  <Image
                    src={cover.url}
                    alt=''
                    fill
                    sizes='56px'
                    className='object-cover'
                  />
                ) : (
                  <Building2
                    aria-hidden
                    className='absolute inset-0 m-auto size-5 text-muted-foreground'
                  />
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                  <p className='truncate font-medium'>{row.name}</p>
                  <StageBadge stage={row.stage} />
                </div>
                <p className='mt-0.5 truncate text-sm text-muted-foreground'>
                  {[place, `Updated ${formatRelativeTime(row.updatedAt)}`].filter(Boolean).join(' · ')}
                </p>
                <p className='mt-0.5 text-sm text-muted-foreground'>{STAGE_META[row.stage].next}</p>
                {showNote && row.reviewNote && (row.stage === 'sent-back' || row.stage === 'live-changes-sent-back' || row.stage === 'rejected') && (
                  <p className='mt-2 rounded-xl bg-sunset-50 px-3 py-2 text-sm text-pretty text-sunset-950'>
                    <span className='font-medium'>Note from the team: </span>
                    {row.reviewNote}
                  </p>
                )}
              </div>
            </div>
            <div className='flex shrink-0 items-center justify-end gap-2 sm:w-auto'>
              {live && (
                <span className='mr-2 inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums'>
                  <Eye
                    aria-hidden
                    className='size-4'
                  />
                  {row.views30.toLocaleString('en-NG')}
                  <span className='sr-only'> {row.views30 === 1 ? 'view' : 'views'}</span>
                  <span className='hidden lg:inline'>&nbsp;in 30 days</span>
                </span>
              )}
              <AgentListingPrimary listing={row} />
              <AgentListingActions
                listing={{
                  id: row.id,
                  name: row.name,
                  slug: row.slug,
                  stage: row.stage,
                  availability: row.availability,
                  neverLive: row.publishedAt === null,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
