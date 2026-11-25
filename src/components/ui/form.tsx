"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "rounded-control border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 " +
  "transition focus:border-brand-fg focus:outline-none focus:ring-3 focus:ring-brand-fg/15 disabled:opacity-60";

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Label, control, hint and error wired together for assistive technology. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={hintId} role="alert" className="animate-fade-in text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  inputClassName?: string;
}

export function TextField({ label, hint, error, className, inputClassName, ...rest }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, "h-12 w-full", error && "border-danger", inputClassName)}
          {...rest}
        />
      )}
    </Field>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}

export function TextAreaField({ label, hint, error, className, rows = 4, ...rest }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, "w-full py-3 leading-relaxed", error && "border-danger")}
          {...rest}
        />
      )}
    </Field>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}

export function SelectField({ label, hint, error, className, children, ...rest }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <select id={id} aria-describedby={describedBy} className={cn(CONTROL, "h-12 w-full pr-8")} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

/** A bare select for toolbars, where a visible label would be noise. */
export function Select({ className, label, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <select aria-label={label} className={cn(CONTROL, "h-10 max-w-full pr-8 text-sm", className)} {...rest} />;
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[13px] text-ink-3">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition disabled:opacity-50",
          checked ? "border-transparent bg-brand" : "border-line-strong bg-well",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 size-5 -translate-y-1/2 rounded-full shadow transition-all",
            checked ? "left-[1.45rem] bg-accent" : "left-1 bg-ink-3",
          )}
        />
      </button>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** A compact either/or switch; scrolls sideways when the options do not fit. */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-well p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-full font-semibold whitespace-nowrap transition",
              size === "md" ? "h-9 px-4 text-sm" : "h-8 px-3 text-[13px]",
              active ? "bg-brand text-brand-ink shadow-sm" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    // Keyed by the message, so each new error gives the form a short shake.
    <p key={typeof children === "string" ? children : undefined} role="alert" className="animate-shake rounded-control bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
      {children}
    </p>
  );
}
