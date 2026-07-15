import type { SVGProps } from "react";

type BrandMarkProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function BrandMark({ title, ...props }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 48 48" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} {...props}>
      {title ? <title>{title}</title> : null}
      <path d="M9 35.5c7.5-5.8 15.5-5.8 24.2-1.9 2.2 1 4.1 1.1 5.8.4" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M20 36V11" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M22 12h16l-4.5 5 4.5 5H22z" fill="currentColor" />
      <circle cx="20" cy="38" r="3.25" fill="currentColor" />
    </svg>
  );
}
