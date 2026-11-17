import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Labelled text input for the public forms (contact, property enquiry), with hint and error wired to aria. */
export function TextInput({
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

export function FieldMessage({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p
      id={id}
      className='mt-1 text-sm text-destructive'>
      {error}
    </p>
  );
}
