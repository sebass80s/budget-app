"use client";
import { useState } from "react";
import { useCloudSync } from "@/hooks/useCloudSync";
type Cloud = ReturnType<typeof useCloudSync>;

export function CloudPanel({ cloud, mode = "settings" }: { cloud: Cloud; mode?: "welcome" | "settings" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(create: boolean) {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    try { await cloud.signIn(email.trim(), password, create); setPassword(""); }
    finally { setBusy(false); }
  }
  return (
    <section className={"panel form-panel cloud-panel" + (mode === "welcome" ? " cloud-welcome" : "")}>
      <div className="mini-caption">{mode === "welcome" ? "VÄLKOMMEN" : "FIREBASE"}</div>
      <h2>{mode === "welcome" ? "Logga in" : "Ditt konto"}</h2>
      {cloud.status === "loading" && <p className="settings-copy">Hämtar din budget från Firebase …</p>}
      {cloud.status === "disabled" && <p className="settings-copy">Firebase är inte konfigurerat. Appen kan inte användas just nu.</p>}
      {cloud.status === "signedOut" && <>
        <p className="settings-copy">Logga in eller skapa konto för att fortsätta med din budget.</p>
        <form className="form" onSubmit={event => { event.preventDefault(); void submit(false); }}>
          <label>E-post <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Lösenord <input type="password" minLength={6} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button disabled={busy} type="submit" className="button button-primary">Logga in</button>
          <button disabled={busy} type="button" className="button button-outline" onClick={() => submit(true)}>Skapa konto</button>
        </form>
      </>}
      {cloud.email && <>
        <p className="settings-copy">Inloggad som <strong>{cloud.email}</strong>.</p>
        {(cloud.status === "active" || cloud.status === "saving") &&
          <p className="settings-copy">{cloud.status === "saving" ? "Sparar i Firebase …" : "Molnbudgeten är ansluten."}</p>}
        {cloud.status === "offline" && <p className="settings-copy">Du behöver internet för att läsa eller ändra budgeten.</p>}
        {(cloud.status === "offline" || cloud.status === "error") &&
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Försök ansluta igen</button>}
        <button disabled={cloud.status === "saving"} className="button button-outline" type="button" onClick={cloud.signOut}>Logga ut</button>
      </>}
      {cloud.message && <p className="form-hint" role="status">{cloud.message}</p>}
      {!cloud.email && (cloud.status === "disabled" || cloud.status === "error" || cloud.status === "offline") &&
        <button type="button" className="button button-outline" onClick={() => window.location.reload()}>Försök igen</button>}
      {mode === "settings" && <p className="form-hint">All budgetdata hämtas och sparas direkt i Firebase. Utan uppkoppling kan du inte göra ändringar. En separat JSON-backup kan exporteras manuellt under Inställningar.</p>}
    </section>
  );
}
