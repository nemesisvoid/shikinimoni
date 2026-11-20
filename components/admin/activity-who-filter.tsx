'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ANYONE = 'anyone';

/** "Who" filter for the activity log. Changing it goes back to page 1. */
export function ActivityWhoFilter({ actors, value, hrefFor }: { actors: { id: string; label: string }[]; value?: string; hrefFor: Record<string, string> }) {
  const router = useRouter();
  const items = { [ANYONE]: 'Anyone', ...Object.fromEntries(actors.map(a => [a.id, a.label])) };
  return (
    <Select
      items={items}
      value={value ?? ANYONE}
      onValueChange={v => router.push(hrefFor[v && v !== ANYONE ? v : ANYONE], { scroll: false })}>
      <SelectTrigger
        aria-label='Who made the change'
        className={cn('w-full sm:w-auto sm:min-w-48', value && 'border-primary/40 bg-plum-50/60')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value={ANYONE}>Anyone</SelectItem>
        {actors.map(a => (
          <SelectItem
            key={a.id}
            value={a.id}>
            {a.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
