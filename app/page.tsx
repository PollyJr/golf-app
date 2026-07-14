"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Flag, Globe2, KeyRound, ShieldCheck, Trophy } from "lucide-react";

const COPY = {
  nl: { label:"De club. Altijd dichtbij.", title:"Meer dan een scorekaart.", body:"Beleef je golfclub vóór, tijdens en na je ronde. Houd scores bij, klim in het klassement en mis geen enkel clubevent.", start:"Open de clubapp", admin:"Naar clubbeheer", code:"Spelerscode", pin:"Persoonlijke pincode", login:"Inloggen als speler", demo:"Bekijk de demo" },
  en: { label:"Your club. Always close.", title:"More than a scorecard.", body:"Experience your golf club before, during and after every round. Track scores, climb the leaderboard and never miss a club event.", start:"Open club app", admin:"Club management", code:"Player code", pin:"Personal PIN", login:"Sign in as player", demo:"View the demo" }
};

export default function WelcomePage() {
  const router=useRouter();
  const [language,setLanguage]=useState<"nl"|"en">("nl");
  const [code,setCode]=useState("TWT-4821"); const [pin,setPin]=useState("4821");
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false);
  const copy=COPY[language];
  async function login(event:React.FormEvent){event.preventDefault();setLoading(true);setError("");try{const response=await fetch("/api/player/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code,pin})});if(!response.ok){setError(language==="nl"?"Controleer je spelerscode en pincode.":"Check your player code and PIN.");return}router.push("/app")}catch{setError(language==="nl"?"Inloggen lukt nu niet. Probeer opnieuw.":"Sign-in is unavailable. Please retry.")}finally{setLoading(false)}}
  return <main className="welcome">
    <nav className="welcome-nav">
      <div className="brand brand-light"><span className="brand-mark"><Flag size={19}/></span><span>FAIRWAY<span className="brand-dot">.</span></span></div>
      <button className="language" onClick={()=>setLanguage(language==="nl"?"en":"nl")}><Globe2 size={16}/>{language.toUpperCase()}</button>
    </nav>
    <section className="welcome-grid">
      <div className="welcome-copy">
        <div className="eyebrow light"><span/> {copy.label}</div>
        <h1>{copy.title}</h1><p>{copy.body}</p>
        <div className="welcome-features"><span><Trophy size={17}/> Live klassementen</span><span><ShieldCheck size={17}/> Goedgekeurde scores</span><span><Check size={17}/> Werkt offline</span></div>
        <Link href="/app" className="text-link">{copy.demo}<ArrowRight size={17}/></Link>
      </div>
      <form className="login-panel" onSubmit={login}>
        <div className="login-top"><div className="login-icon"><KeyRound size={23}/></div><div><span>Welkom terug</span><h2>{copy.start}</h2></div></div>
        <label>{copy.code}<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} autoCapitalize="characters"/></label>
        <label>{copy.pin}<input type="password" value={pin} onChange={e=>setPin(e.target.value)} inputMode="numeric"/></label>
        {error&&<p className="login-error">{error}</p>}
        <button type="submit" className="primary-button" disabled={loading}>{loading?"Even wachten…":copy.login}<ArrowRight size={18}/></button>
        <div className="login-divider"><span>of</span></div>
        <Link href="/admin" className="secondary-button">{copy.admin}</Link>
        <p className="login-help">Je code of pincode vergeten? <button>Vraag je club</button></p>
      </form>
    </section>
    <div className="welcome-course"><div className="course-line"/><span>SHORTGOLF TWENTE</span><b>EST. 2009</b></div>
  </main>;
}
