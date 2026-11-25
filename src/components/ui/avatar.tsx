import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { avatarHue } from "@/lib/theme";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<AvatarSize, string> = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
};

interface AvatarProps {
  name: string;
  initials: string;
  size?: AvatarSize;
  /** Guests get a neutral, dashed avatar. */
  guest?: boolean;
  className?: string;
}

export function Avatar({ name, initials, size = "md", guest, className }: AvatarProps) {
  const hue = avatarHue(name);
  const style: CSSProperties = guest
    ? {}
    : { backgroundColor: `oklch(0.9 0.06 ${hue})`, color: `oklch(0.32 0.09 ${hue})` };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-bold tracking-wide",
        guest && "border border-dashed border-line-strong bg-well text-ink-3",
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

interface AvatarStackProps {
  people: ReadonlyArray<{ name: string; initials: string; guest?: boolean }>;
  size?: AvatarSize;
  className?: string;
}

export function AvatarStack({ people, size = "sm", className }: AvatarStackProps) {
  return (
    <span className={cn("inline-flex -space-x-2", className)}>
      {people.map((person, index) => (
        <Avatar key={`${person.name}-${index}`} {...person} size={size} className="ring-2 ring-surface" />
      ))}
    </span>
  );
}
