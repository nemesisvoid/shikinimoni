"use client";

import type { ReactNode } from "react";
import {
  Controller,
  useFormContext,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
} from "react-hook-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PropertyFormValues } from "./values";

type Name = FieldPath<PropertyFormValues>;

export type FieldControl<N extends Name> = {
  field: ControllerRenderProps<PropertyFormValues, N>;
  fieldState: ControllerFieldState;
  /** Spread onto the control: id, aria-invalid and aria-describedby. */
  a11y: { id: string; "aria-invalid": boolean; "aria-describedby"?: string };
};

type FormFieldProps<N extends Name> = {
  name: N;
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  children: (control: FieldControl<N>) => ReactNode;
};

/**
 * Label + control + description + error, wired to react-hook-form. The error
 * replaces the description so the field never grows two lines of help.
 */
export function FormField<N extends Name>({ name, label, description, required, className, children }: FormFieldProps<N>) {
  const { control } = useFormContext<PropertyFormValues>();
  const id = `property-${name}`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const invalid = fieldState.invalid;
        const describedBy = invalid ? `${id}-error` : description ? `${id}-description` : undefined;
        return (
          <Field data-invalid={invalid} className={className}>
            <FieldLabel htmlFor={id}>
              {label}
              {required && (
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              )}
              {required && <span className="sr-only">(required)</span>}
            </FieldLabel>
            {children({ field, fieldState, a11y: { id, "aria-invalid": invalid, "aria-describedby": describedBy } })}
            {invalid ? (
              <FieldError id={`${id}-error`} errors={[fieldState.error]} />
            ) : (
              description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
            )}
          </Field>
        );
      }}
    />
  );
}

type TextFieldProps<N extends Name> = Omit<FormFieldProps<N>, "children"> &
  Omit<React.ComponentProps<"input">, "name" | "id" | "value" | "onChange" | "onBlur" | "ref" | "required"> & {
    /** Runs on blur after react-hook-form's own handler, e.g. to format a number. */
    format?: (value: string) => string;
  };

export function TextField<N extends Name>({ name, label, description, required, className, format, ...input }: TextFieldProps<N>) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {({ field, a11y }) => (
        <Input
          {...input}
          {...a11y}
          ref={field.ref}
          name={field.name}
          value={String(field.value ?? "")}
          onChange={field.onChange}
          onBlur={() => {
            if (format) field.onChange(format(String(field.value ?? "")));
            field.onBlur();
          }}
        />
      )}
    </FormField>
  );
}

/** Whole numbers (rooms, floors, year). Mobile keyboards show the number pad. */
export function CountField<N extends Name>(props: TextFieldProps<N>) {
  return <TextField inputMode="numeric" autoComplete="off" placeholder="–" {...props} />;
}

export function TextAreaField<N extends Name>({
  name,
  label,
  description,
  required,
  className,
  ...textarea
}: Omit<FormFieldProps<N>, "children"> &
  Omit<React.ComponentProps<"textarea">, "name" | "id" | "value" | "onChange" | "onBlur" | "ref" | "required">) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {({ field, a11y }) => (
        <Textarea
          {...textarea}
          {...a11y}
          ref={field.ref}
          name={field.name}
          value={String(field.value ?? "")}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />
      )}
    </FormField>
  );
}

/**
 * `options` maps stored value → label. An empty string value means "nothing
 * chosen", which shows the placeholder.
 */
export function SelectField<N extends Name>({
  name,
  label,
  description,
  required,
  className,
  options,
  placeholder = "Choose…",
  disabled,
  onValueChange,
}: Omit<FormFieldProps<N>, "children"> & {
  options: Record<string, ReactNode>;
  placeholder?: string;
  disabled?: boolean;
  /** Runs after the field updates, e.g. to reset a dependent field. */
  onValueChange?: (value: string) => void;
}) {
  return (
    <FormField name={name} label={label} description={description} required={required} className={className}>
      {({ field, a11y }) => (
        <Select
          items={options}
          value={field.value === "" ? null : (field.value as string)}
          onValueChange={(value) => {
            field.onChange(value ?? "");
            onValueChange?.(value ?? "");
          }}
          onOpenChange={(open) => !open && field.onBlur()}
          disabled={disabled}
        >
          <SelectTrigger {...a11y} ref={field.ref} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {Object.entries(options).map(([value, text]) => (
              <SelectItem key={value} value={value}>
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

export type Choice = { value: string; label: string; hint?: string; icon?: ReactNode };

/** Radio group drawn as selectable cards. Use for short lists where seeing every option helps. */
export function ChoiceField<N extends Name>({
  name,
  legend,
  choices,
  required,
  className,
  onValueChange,
}: {
  name: N;
  legend: string;
  choices: readonly Choice[];
  required?: boolean;
  /** Grid classes for the cards. */
  className?: string;
  onValueChange?: (value: string) => void;
}) {
  const { control } = useFormContext<PropertyFormValues>();
  const id = `property-${name}`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid} className="gap-0">
          <FieldLegend variant="label" className="mb-2">
            {legend}
            {required && (
              <span className="ml-1 text-destructive" aria-hidden>
                *
              </span>
            )}
          </FieldLegend>
          <RadioGroup
            ref={field.ref}
            name={field.name}
            value={field.value === "" ? null : field.value}
            onValueChange={(value) => {
              field.onChange(value);
              onValueChange?.(String(value));
            }}
            aria-invalid={fieldState.invalid}
            aria-describedby={fieldState.invalid ? `${id}-error` : undefined}
            className={cn("grid gap-2.5", className)}
          >
            {choices.map((choice) => {
              const itemId = `${id}-${choice.value}`;
              return (
                <FieldLabel key={choice.value} htmlFor={itemId} className="cursor-pointer has-data-checked:border-primary has-data-checked:bg-plum-50/60 dark:has-data-checked:bg-plum-950/40">
                  <Field orientation="horizontal" className="gap-3 p-3.5!">
                    {choice.icon && (
                      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground in-has-data-checked:bg-primary in-has-data-checked:text-primary-foreground [&_svg]:size-4.5">
                        {choice.icon}
                      </span>
                    )}
                    <FieldContent className="gap-0.5">
                      <FieldTitle>{choice.label}</FieldTitle>
                      {choice.hint && <FieldDescription className="text-xs">{choice.hint}</FieldDescription>}
                    </FieldContent>
                    <RadioGroupItem value={choice.value} id={itemId} />
                  </Field>
                </FieldLabel>
              );
            })}
          </RadioGroup>
          {fieldState.invalid && <FieldError id={`${id}-error`} className="mt-2" errors={[fieldState.error]} />}
        </FieldSet>
      )}
    />
  );
}

/** On/off setting with a title and an explanation, laid out as one clickable row. */
export function SwitchField<N extends Name>({ name, label, description }: { name: N; label: string; description?: string }) {
  const { control } = useFormContext<PropertyFormValues>();
  const id = `property-${name}`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className="items-start justify-between gap-4">
          <FieldContent>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
          </FieldContent>
          <Switch
            id={id}
            ref={field.ref}
            name={field.name}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            aria-describedby={description ? `${id}-description` : undefined}
            className="mt-0.5"
          />
        </Field>
      )}
    />
  );
}

/** Titled group of fields inside the form, with an anchor for the jump links. */
export function FormSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-6 rounded-2xl border bg-card", className)}>
      <header className="border-b px-5 py-4 sm:px-6">
        <h2 id={`${id}-title`} className="font-heading text-base font-bold tracking-tight">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="flex flex-col gap-6 p-5 sm:p-6">{children}</div>
    </section>
  );
}

/** Thousands separators on blur: "25000000" → "25,000,000". Leaves anything unparseable alone. */
export function formatAmount(value: string) {
  const cleaned = value.replace(/[₦$£€,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return value;
  const [whole, decimals] = cleaned.split(".");
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}
