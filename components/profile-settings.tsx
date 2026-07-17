"use client";

import { useState } from "react";
import { AtSign, Check, KeyRound } from "lucide-react";
import { secureHeaders } from "@/lib/client-security";

function pinValue(value: string) { return value.replace(/\D/g, "").slice(0, 12); }

export function ProfileSettings({ initialUsername }: { initialUsername: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState<"username" | "pin" | "">("");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [pinMessage, setPinMessage] = useState("");

  async function saveUsername(event: React.FormEvent) {
    event.preventDefault(); setSaving("username"); setUsernameMessage("");
    try {
      const response = await fetch("/api/player/profile", { method: "PATCH", headers: secureHeaders(), body: JSON.stringify({ action: "username", username }) });
      const data = await response.json();
      if (!response.ok) { setUsernameMessage(data.code === "USERNAME_TAKEN" ? "Deze gebruikersnaam is al bezet." : "Gebruik 3–30 kleine letters, cijfers, punten, strepen of underscores."); return; }
      setUsername(data.username); setUsernameMessage("Gebruikersnaam opgeslagen.");
    } catch { setUsernameMessage("Opslaan lukt nu niet. Probeer het opnieuw."); }
    finally { setSaving(""); }
  }

  async function savePin(event: React.FormEvent) {
    event.preventDefault(); setPinMessage("");
    if (newPin !== confirmPin) { setPinMessage("De nieuwe pincodes zijn niet gelijk."); return; }
    setSaving("pin");
    try {
      const response = await fetch("/api/player/profile", { method: "PATCH", headers: secureHeaders(), body: JSON.stringify({ action: "pin", currentPin, newPin }) });
      const data = await response.json();
      if (!response.ok) {
        const message = data.code === "CURRENT_PIN_INVALID" ? "Je huidige pincode klopt niet." : data.code === "PIN_UNCHANGED" ? "Kies een andere pincode." : "De pincode kon niet worden aangepast.";
        setPinMessage(message); return;
      }
      setCurrentPin(""); setNewPin(""); setConfirmPin(""); setPinMessage("Pincode veilig aangepast. Andere sessies zijn uitgelogd.");
    } catch { setPinMessage("Opslaan lukt nu niet. Probeer het opnieuw."); }
    finally { setSaving(""); }
  }

  const pinProps = { type: "password", inputMode: "numeric" as const, pattern: "[0-9]*", minLength: 4, maxLength: 12 };
  return <section className="profile-settings-grid">
    <form className="card profile-setting" onSubmit={saveUsername}>
      <span className="profile-setting-icon"><AtSign size={19}/></span><div><h2>Gebruikersnaam</h2><p>Clubgenoten vinden je met deze unieke naam.</p></div>
      <label>Gebruikersnaam<input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={30}/></label>
      {usernameMessage && <p className="setting-message"><Check size={13}/>{usernameMessage}</p>}
      <button className="secondary-button" disabled={Boolean(saving)}>{saving === "username" ? "Opslaan…" : "Gebruikersnaam opslaan"}</button>
    </form>
    <form className="card profile-setting" onSubmit={savePin}>
      <span className="profile-setting-icon"><KeyRound size={19}/></span><div><h2>Pincode wijzigen</h2><p>Gebruik 4 tot 12 cijfers die alleen jij kent.</p></div>
      <label>Huidige pincode<input {...pinProps} autoComplete="current-password" value={currentPin} onChange={(event) => setCurrentPin(pinValue(event.target.value))} required/></label>
      <div className="pin-field-row"><label>Nieuwe pincode<input {...pinProps} autoComplete="new-password" value={newPin} onChange={(event) => setNewPin(pinValue(event.target.value))} required/></label><label>Herhaal pincode<input {...pinProps} autoComplete="new-password" value={confirmPin} onChange={(event) => setConfirmPin(pinValue(event.target.value))} required/></label></div>
      {pinMessage && <p className="setting-message"><Check size={13}/>{pinMessage}</p>}
      <button className="secondary-button" disabled={Boolean(saving)}>{saving === "pin" ? "Veilig opslaan…" : "Pincode aanpassen"}</button>
    </form>
  </section>;
}
