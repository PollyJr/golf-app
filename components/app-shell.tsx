"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Flag, Home, Map, Plus, Settings, Trophy, UserRound } from "lucide-react";
import { ServiceWorker } from "./service-worker";

const nav=[
  {href:"/app",label:"Overzicht",icon:Home},
  {href:"/app/play",label:"Nieuwe ronde",icon:Plus},
  {href:"/app/leaderboards",label:"Klassement",icon:Trophy},
  {href:"/app/events",label:"Evenementen",icon:CalendarDays},
  {href:"/app/courses",label:"Banen",icon:Map},
  {href:"/app/profile",label:"Mijn profiel",icon:UserRound},
];

export function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname(); const active=(href:string)=>href==="/app"?path===href:path.startsWith(href);
  return <div className="app-shell"><ServiceWorker/>
    <aside className="sidebar">
      <Link href="/app" className="brand"><span className="brand-mark"><Flag size={19}/></span><span>FAIRWAY<span className="brand-dot">.</span></span></Link>
      <div className="club-switch"><span className="club-avatar">ST</span><span><b>Shortgolf Twente</b><small>Mijn club</small></span></div>
      <nav className="side-nav">{nav.map(item=><Link key={item.href} className={active(item.href)?"active":""} href={item.href}><item.icon size={17}/>{item.label}</Link>)}</nav>
      <div className="side-bottom"><nav className="side-nav"><Link href="/admin"><Settings size={17}/> Clubbeheer</Link></nav><div className="user-mini"><span className="avatar">SV</span><span><b>Sophie de Vries</b><small>TWT-4821</small></span></div></div>
    </aside>
    <main className="app-main">
      <header className="app-topbar"><Link href="/app" className="brand mobile-brand"><span className="brand-mark"><Flag size={18}/></span><span>FAIRWAY<span className="brand-dot">.</span></span></Link><div className="top-actions"><button className="icon-button" aria-label="Meldingen"><Bell size={17}/><i className="notification-dot"/></button><span className="avatar">SV</span></div></header>
      {children}
    </main>
    <nav className="mobile-nav"><LinkButton href="/app" label="Home" icon={Home} active={active("/app")&&path==="/app"}/><LinkButton href="/app/leaderboards" label="Ranking" icon={Trophy} active={active("/app/leaderboards")}/><LinkButton href="/app/play" label="Spelen" icon={Plus} active={active("/app/play")} main/><LinkButton href="/app/events" label="Events" icon={CalendarDays} active={active("/app/events")}/><LinkButton href="/app/profile" label="Profiel" icon={UserRound} active={active("/app/profile")}/></nav>
  </div>;
}
function LinkButton({href,label,icon:Icon,active,main}:{href:string;label:string;icon:typeof Home;active:boolean;main?:boolean}){return <Link href={href} className={`${active?"active":""} ${main?"play-main":""}`}><Icon size={main?22:19}/>{!main&&<span>{label}</span>}</Link>}
