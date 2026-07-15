"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) {
        setError(response.status === 429 ? "Te veel pogingen. Probeer het over 15 minuten opnieuw." : "E-mailadres of wachtwoord is onjuist.");
        return;
      }
      router.replace(data.redirectTo || "/admin");
      router.refresh();
    } catch {
      setError("Inloggen is nu niet beschikbaar.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="welcome admin-login-page"><nav className="welcome-nav"><div className="brand brand-light"><span className="brand-mark"><BrandMark /></span><span>FAIRWAY<span className="brand-dot">.</span></span></div><Link href="/" className="text-link"><ArrowLeft size={16} /> Spelerslogin</Link></nav><section className="welcome-grid"><div className="welcome-copy"><div className="eyebrow light"><span /> beveiligd clubbeheer</div><h1>Beheer je volledige golfomgeving.</h1><p>Spelerscodes, banen, rondes en evenementen blijven strikt gescheiden per club en accountrol.</p><div className="welcome-features"><span><ShieldCheck size={17} /> Beveiligde sessies</span><span><LockKeyhole size={17} /> Rol- en clubcontrole</span></div></div><form className="login-panel" onSubmit={login}><div className="login-top"><div className="login-icon"><LockKeyhole size={23} /></div><div><span>Club- en platformbeheer</span><h2>Beveiligd inloggen</h2></div></div><label>E-mailadres<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Wachtwoord<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="login-error">{error}</p>}<button className="primary-button" disabled={loading}>{loading ? "Controleren…" : "Inloggen"}<ArrowRight size={18} /></button></form></section></main>;
}
