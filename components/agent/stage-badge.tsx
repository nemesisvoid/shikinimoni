import type { AgentListingStage } from '@/lib/agents/queries';
import { cn } from '@/lib/utils';

/** Where an agent's listing stands, in their words. Always text; colour only reinforces it. */
export const STAGE_META: Record<AgentListingStage, { label: string; className: string; next: string }> = {
  draft: { label: 'Draft', className: 'bg-ink-100 text-ink-700 ring-ink-200', next: 'Finish it and submit it for review.' },
  'sent-back': { label: 'Changes needed', className: 'bg-sunset-100 text-sunset-900 ring-sunset-200', next: 'Make the changes in the note, then submit it again.' },
  pending: { label: 'Waiting for review', className: 'bg-azure-50 text-azure-800 ring-azure-200', next: 'The team will check it soon.' },
  live: { label: 'Live', className: 'bg-plum-50 text-plum-800 ring-plum-200', next: 'On the site now.' },
  'live-changes-pending': {
    label: 'Live, changes in review',
    className: 'bg-azure-50 text-azure-800 ring-azure-200',
    next: 'On the site as before; your changes are with the team.',
  },
  'live-changes-sent-back': {
    label: 'Live, changes need work',
    className: 'bg-sunset-100 text-sunset-900 ring-sunset-200',
    next: 'Update your changes using the note, then submit them again.',
  },
  rejected: { label: 'Not approved', className: 'bg-destructive/10 text-destructive ring-destructive/20', next: 'This listing won’t be published.' },
  archived: { label: 'Archived', className: 'bg-background text-muted-foreground ring-border', next: 'Taken off the site by the team.' },
};

export function StageBadge({ stage, className }: { stage: AgentListingStage; className?: string }) {
  const meta = STAGE_META[stage];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset', meta.className, className)}>
      {meta.label}
    </span>
  );
}
