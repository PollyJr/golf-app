import type { ComponentType, SVGProps } from "react";

export type FairwayIcon = ComponentType<IconProps>;

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

function IconBase({ size = 20, children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function OverviewIcon(props: IconProps) {
  return <IconBase {...props}><path d="M3.5 17.5c4-3 7.5-3.2 11.2-.7 2 1.3 3.9 1.5 5.8.4"/><path d="M8.5 17V5.2M9.5 5.5h7l-2.2 2.4 2.2 2.4h-7"/><circle cx="8.5" cy="19" r="1.4" fill="currentColor" stroke="none"/></IconBase>;
}

export function PlayIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="9" cy="15" r="5.5"/><path d="M7.2 12.5h.1M10.5 13.8h.1M7.8 16.6h.1M11.1 17.3h.1M17 4v7M13.5 7.5h7"/></IconBase>;
}

export function RankingIcon(props: IconProps) {
  return <IconBase {...props}><path d="M8 4.5h8v3.2c0 3.1-1.7 5.3-4 5.3S8 10.8 8 7.7zM10 13v3.2M14 13v3.2M8 19.5h8M9.5 16.5h5"/><path d="M8 6H4.5v1.4c0 2 1.4 3.5 3.5 3.5M16 6h3.5v1.4c0 2-1.4 3.5-3.5 3.5"/></IconBase>;
}

export function EventsIcon(props: IconProps) {
  return <IconBase {...props}><rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17M9 17v-4M9 13h5l-1.7 1.6 1.7 1.6H9"/></IconBase>;
}

export function CoursesIcon(props: IconProps) {
  return <IconBase {...props}><path d="m3.5 6 5-2.5 7 2.5 5-2.5v14l-5 2.5-7-2.5-5 2.5zM8.5 3.5v14M15.5 6v14"/><path d="M10.8 9.4c1.1-.6 2.3-.5 3.5.2"/><circle cx="12.5" cy="12" r="1" fill="currentColor" stroke="none"/></IconBase>;
}

export function ProfileIcon(props: IconProps) {
  return <IconBase {...props}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-4.1 3-6.2 7-6.2s6.5 2.1 7 6.2M17.5 5.5h3v5"/></IconBase>;
}
