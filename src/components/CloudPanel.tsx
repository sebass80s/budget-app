"use client";
import { useState } from "react";
import { useCloudSync } from "@/hooks/useCloudSync";
type Cloud = ReturnType<typeof useCloudSync>;
export function CloudPanel({ cloud }: { cloud: Cloud }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(create: boolean) {
    if (!email.trim() || !password) return;
    setBusy(true);
    try { await cloud.signIn(email.trim(),password,create); setPassword(""); }
    finally { setBusy(false); }
  }
  return (
    <section className="panel form-panel cloud-panel">
      <div className="mini-caption">MOLNLAGRING</div>
      <h2>Din budget på alla enheter</h2>
      {cloud.status === "disabled" && <p className="settings-copy">
        Firebase är inte konfigurerat ännu. Appen fungerar tills vidare helt lokalt.
        Se docs/FIREBASE_SETUP.md i GitHub-repot för att aktivera molnlagring.
      </p>}
      {cloud.status === "loading" && <p className="settings-copy">Kontrollerar molnanslutningen …</p>}
      {cloud.status === "signedOut" && <>
        <p className="settings-copy">Logga in med e-post och lösenord. Din lokala budget behålls tills du aktivt väljer att koppla den till molnet.</p>
        <div className="form">
          <label>E-post <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Lösenord <input type="password" minLength={6} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button disabled={busy} type="button" className="button button-primary" onClick={() => submit(false)}>Logga in</button>
          <button disabled={busy} type="button" className="button button-outline" onClick={() => submit(true)}>Skapa konto</button>
        </div>
      </>}
      {(cloud.status === "ready" || cloud.status === "active" || cloud.status === "saving" || cloud.status === "blocked" || cloud.status === "error") && cloud.email && <>
        <p className="settings-copy">Inloggad som <strong>{cloud.email}</strong>.</p>
        {(cloud.status === "active" || cloud.status === "saving") &&
          <p className="settings-copy">{cloud.status === "saving" ? "Sparar i molnet …" : "Molnsynkronisering aktiv."}</p>}
        {(cloud.status === "ready" || cloud.status === "blocked" || cloud.status === "error") &&
          <button className="button button-primary" type="button" onClick={cloud.connect}>
            {cloud.exists ? "Hämta molnbudget" : "Lägg min budget i molnet"}
          </button>}
        {cloud.status === "blocked" &&
          <button className="button button-outline" type="button" onClick={cloud.retry}>Försök synka igen</button>}
        {cloud.hasLocalBackup && cloud.status !== "saving" && <>
          <button className="button button-outline" type="button" onClick={cloud.restoreLocalCopy}>Återställ tidigare lokal budget</button>
          <p className="form-hint">En kopia av din tidigare lokala budget finns kvar på den här enheten. Återställning påverkar inte molnbudgeten.</p>
        </>}
        <button className="button button-outline" type="button" onClick={cloud.signOut}>Logga ut</button>
      </>}
      {cloud.message && <p className="form-hint" role="status">{cloud.message}</p>}
      <p className="form-hint">Molnlagring kräver internet. Appen behåller en lokal kopia, men offlineändringar sammanfogas inte automatiskt. Vid molnhämtning sparas en tidigare lokal budget på enheten utan att öppna en JSON-fil. Vill du ha en separat fil väljer du Exportera JSON-backup under Inställningar.</p>
    </section>
  );
}
