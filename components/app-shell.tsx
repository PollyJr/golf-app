"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Settings } from "lucide-react";
import { BrandMark } from "./brand";
import { CoursesIcon, EventsIcon, OverviewIcon, PlayIcon, ProfileIcon, RankingIcon, type FairwayIcon } from "./fairway-icons";
import { ServiceWorker } from "./service-worker";

import { LogoutButton } from "./logout-button";
const nav=[
  {href:"/app",label:"Overzicht",icon:OverviewIcon},
  {href:"/app/play",label:"Nieuwe ronde",icon:PlayIcon},
  {href:"/app/leaderboards",label:"Klassement",icon:RankingIcon},
  {href:"/app/events",label:"Evenementen",icon:EventsIcon},
  {href:"/app/courses",label:"Banen",icon:CoursesIcon},
  {href:"/app/profile",label:"Mijn profiel",icon:ProfileIcon},
];

export function AppShell({children,user}:{children:React.ReactNode;user:{displayName:string;initials:string;code:string;clubName:string}}){
  const path=usePathname(); const active=(href:string)=>href==="/app"?path===href:path.startsWith(href);
  return <div className="app-shell"><ServiceWorker/>
    <aside className="sidebar">
      <Link href="/app" className="brand" aria-label="Fairway Club"><span className="brand-mark"><BrandMark/></span><span>FAIRWAY<span className="brand-dot">.</span></span></Link>
      <div className="club-switch"><span className="club-avatar">{user.clubName.slice(0,2).toUpperCase()}</span><span><b>{user.clubName}</b><small>Mijn club</small></span></div>
      <nav className="side-nav">{nav.map(item=><Link key={item.href} className={active(item.href)?"active":""} href={item.href}><item.icon size={17}/>{item.label}</Link>)}</nav>
      <div className="side-bottom"><nav className="side-nav"><Link href="/admin/login"><Settings size={17}/> Clubbeheer</Link></nav><div className="user-mini"><span className="avatar">{user.initials}</span><span><b>{user.displayName}</b><small>{user.code}</small></span></div><LogoutButton compact/></div>
    </aside>
    <main className="app-main">
      <header className="app-topbar"><Link href="/app" className="brand mobile-brand" aria-label="Fairway Club"><span className="brand-mark"><BrandMark/></span><span>FAIRWAY<span className="brand-dot">.</span></span></Link><div className="top-actions"><button className="icon-button" aria-label="Meldingen"><Bell size={17}/><i className="notification-dot"/></button><span className="avatar">{user.initials}</span></div></header>
      {children}
    </main>
    <nav className="mobile-nav"><LinkButton href="/app" label="Home" icon={OverviewIcon} active={active("/app")&&path==="/app"}/><LinkButton href="/app/leaderboards" label="Ranking" icon={RankingIcon} active={active("/app/leaderboards")}/><LinkButton href="/app/play" label="Spelen" icon={PlayIcon} active={active("/app/play")} main/><LinkButton href="/app/events" label="Events" icon={EventsIcon} active={active("/app/events")}/><LinkButton href="/app/profile" label="Profiel" icon={ProfileIcon} active={active("/app/profile")}/></nav>
  </div>;
}
function LinkButton({href,label,icon:Icon,active,main}:{href:string;label:string;icon:FairwayIcon;active:boolean;main?:boolean}){return <Link href={href} aria-label={label} className={`${active?"active":""} ${main?"play-main":""}`}><Icon size={main?23:20}/>{!main&&<span>{label}</span>}</Link>}
