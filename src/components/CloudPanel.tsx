"use client";
import { useState } from "react";
import { useCloudSync } from "@/hooks/useCloudSync";
type Cloud = ReturnType<typeof useCloudSync>;

export function CloudPanel({ cloud, mode = "settings" }: { cloud: Cloud; mode?: "welcome" | "settings" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authScreen, setAuthScreen] = useState<"login" | "register">("login");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  async function submit(create: boolean) {
    if (busy || !email.trim() || !password) return;
    if (create && password !== confirmPassword) {
      setFormError("Lösenorden matchar inte.");
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      await cloud.signIn(email.trim(), password, create);
      setPassword("");
      setConfirmPassword("");
    } finally { setBusy(false); }
  }
  function changeScreen(next: "login" | "register") {
    if (busy) return;
    setAuthScreen(next);
    setFormError("");
    setPassword("");
    setConfirmPassword("");
  }
  return (
    <section className={"panel form-panel cloud-panel" + (mode === "welcome" ? " cloud-welcome" : "")}>
      <div className="mini-caption">{mode === "welcome" ? (authScreen === "register" ? "NYTT KONTO" : "VÄLKOMMEN") : "FIREBASE"}</div>
      <h2>{mode === "welcome" ? (authScreen === "register" ? "Skapa konto" : "Logga in") : "Ditt konto"}</h2>
      {cloud.status === "loading" && <p className="settings-copy">Hämtar din budget från Firebase …</p>}
      {cloud.status === "disabled" && <p className="settings-copy">Firebase är inte konfigurerat. Appen kan inte användas just nu.</p>}
      {cloud.status === "signedOut" && <>
        {authScreen === "register" && mode === "welcome" ? <>
          <p className="settings-copy">Fyll i dina uppgifter för att skapa ett konto. Efteråt hjälper vi dig att komma igång med din budget.</p>
          <form className="form" onSubmit={event => { event.preventDefault(); void submit(true); }}>
            <label>E-post <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Lösenord <input type="password" minLength={6} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
            <label>Bekräfta lösenord <input type="password" minLength={6} autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
            {formError && <p role="alert" className="auth-form-error">{formError}</p>}
            <button disabled={busy} type="submit" className="button button-primary">{busy ? "Skapar konto …" : "Skapa mitt konto"}</button>
          </form>
          <button disabled={busy} type="button" className="auth-back" onClick={() => changeScreen("login")}>← Tillbaka till inloggning</button>
        </> : <>
          <p className="settings-copy">Logga in för att fortsätta med din budget.</p>
          <form className="form" onSubmit={event => { event.preventDefault(); void submit(false); }}>
            <label>E-post <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Lösenord <input type="password" minLength={6} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
            <button disabled={busy} type="submit" className="button button-primary">Logga in</button>
          </form>
          {mode === "welcome" && <div className="auth-register-link">
            <span>Har du inget konto?</span>
            <button disabled={busy} type="button" className="button button-outline" onClick={() => changeScreen("register")}>Skapa konto</button>
          </div>}
        </>}
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
