import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:brightness-110 shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)]",
  accent: "bg-accent text-accent-ink hover:brightness-95 shadow-[inset_0_-2px_0_rgb(0_0_0/0.14)]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-well",
  ghost: "text-ink-2 hover:bg-well hover:text-ink",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:brightness-95",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-6 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Button({ variant, size, block, loading, icon, children, className, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, cn(block && "w-full", className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

interface LinkButtonProps extends CommonProps {
  href: string;
  prefetch?: boolean;
  target?: string;
  download?: boolean | string;
  /** Which way the page transition goes; see components/motion/page-transition. */
  transitionTypes?: string[];
  "aria-label"?: string;
}

/** A link that looks like a button; for navigation, never for actions. */
export function LinkButton({ variant, size, block, icon, children, className, href, download, target, transitionTypes, ...rest }: LinkButtonProps) {
  const classes = buttonClass(variant, size, cn(block && "w-full", className));
  if (download !== undefined || target) {
    return (
      <a href={href} className={classes} download={download} target={target} rel={target ? "noreferrer" : undefined} {...rest}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} transitionTypes={transitionTypes} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  children: ReactNode;
  variant?: "ghost" | "secondary" | "primary";
  size?: "sm" | "md";
}

export function IconButton({ label, children, variant = "ghost", size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full transition active:scale-95 disabled:pointer-events-none disabled:opacity-40",
        size === "md" ? "size-11" : "size-9",
        variant === "ghost" && "text-ink-2 hover:bg-well hover:text-ink",
        variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-well",
        variant === "primary" && "bg-brand text-brand-ink hover:brightness-110",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
