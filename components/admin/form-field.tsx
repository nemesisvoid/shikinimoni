import { cn } from '@/lib/utils';

/**
 * Label, control, then a hint or an error, for admin forms. The control gets
 * its id and aria wiring from `field` (render prop), so any input type fits.
 */
export function AdminField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (field: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => React.ReactNode;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className='text-sm font-medium'>
        {label}
        {optional && <span className='ml-1.5 font-normal text-muted-foreground'>(optional)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p
          id={`${id}-error`}
          className='text-sm text-destructive'>
          {error}
        </p>
      ) : (
        hint && (
          <p
            id={`${id}-hint`}
            className='text-xs text-muted-foreground'>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** The form-level message under a form after a failed save. */
export function FormAlert({ message }: { message: string }) {
  return (
    <p
      role='alert'
      className='rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive'>
      {message}
    </p>
  );
}
