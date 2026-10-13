"use client";

import { useState, type FormEvent } from "react";
import { type BudgetDocument, kronaToOre } from "@/lib/budget";
import {
  type SetupKind, type SetupStep, resumeOnboarding,
} from "@/lib/onboarding";

type Props = {
  document: BudgetDocument;
  saving: boolean;
  message: string;
  onSaveEntry: (kind: SetupKind, label: string, amount: string) => Promise<boolean>;
  onFinish: () => Promise<boolean>;
  onSaveStart: (amount: string) => Promise<boolean>;
  onClose?: () => void;
};

const steps: SetupStep[] = ["welcome", "income", "costs", "start", "ready"];
const money = (ore: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(Math.abs(ore) / 100);

export function Onboarding({ document, saving, message, onSaveEntry, onFinish, onSaveStart, onClose }: Props) {
  const [step, setStep] = useState<SetupStep>(() => resumeOnboarding(document));
  const [incomeLabel, setIncomeLabel] = useState("Lön");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [costLabel, setCostLabel] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [startAmount, setStartAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = busy || saving;
  const recurring = document.recurring.filter(r => r.endsOn === null);
  const income = recurring.filter(r => r.amountOre > 0);
  const costs = recurring.filter(r => r.amountOre < 0);
  const currentStep = steps.indexOf(step) + 1;

  function go(next: SetupStep) {
    setError("");
    setStep(next);
  }
  async function save(event: FormEvent<HTMLFormElement>, kind: SetupKind) {
    event.preventDefault();
    if (blocked) return;
    const label = kind === "income" ? incomeLabel : costLabel;
    const amount = kind === "income" ? incomeAmount : costAmount;
    if (!label.trim() || !kronaToOre(amount)) {
      setError("Fyll i en beskrivning och ett belopp större än noll.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const done = await onSaveEntry(kind, label, amount);
      if (done) {
        if (kind === "income") {
          setIncomeAmount("");
          go("costs");
        } else {
          setCostLabel("");
          setCostAmount("");
        }
      }
    } finally { setBusy(false); }
  }
  async function saveStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked) return;
    setError("");
    setBusy(true);
    try {
      if (await onSaveStart(startAmount)) go("ready");
      else setError("Startsaldot kunde inte sparas. Kontrollera anslutningen och försök igen.");
    } finally { setBusy(false); }
  }
  async function finish() {
    if (blocked) return;
    setError("");
    setBusy(true);
    try {
      const done = await onFinish();
      if (!done) setError("Det gick inte att avsluta guiden. Försök igen när Firebase är anslutet.");
    } finally { setBusy(false); }
  }

  return <main className="setup-screen">
    <section className="setup-card" aria-labelledby="setup-heading">
      <header className="setup-top">
        <div className="setup-brand"><span className="brand-mark">◈</span><strong>Agile<span> Economy</span></strong></div>
        <span className="setup-step">Steg {currentStep} av 5</span>
      </header>
      <div className="setup-progress" role="progressbar" aria-label="Introduktionens framsteg"
        aria-valuemin={1} aria-valuemax={5} aria-valuenow={currentStep}>
        <span style={{ width: currentStep * 20 + "%" }} />
      </div>

      {step === "welcome" && <div className="setup-content">
        <div className="setup-emoji" aria-hidden="true">👋</div>
        <h1 id="setup-heading">Välkommen till din budget!</h1>
        <p className="setup-lead">Kom igång på ett par minuter. Vi börjar med pengarna som kommer in och de fasta kostnaderna. Sedan kan du registrera dina vardagsutgifter.</p>
        <div className="setup-steps-summary">
          <div><span>1</span> Lägg till månadsinkomst</div>
          <div><span>2</span> Lägg till fasta kostnader</div>
          <div><span>3</span> Ange pengar kvar just nu (en gång)</div>
          <div><span>4</span> Följ din dagsbudget och registrera utgifter</div>
        </div>
        <button className="button button-primary setup-primary" onClick={() => go("income")} type="button">Kom igång →</button>
      </div>}

      {step === "income" && <div className="setup-content">
        <div className="mini-caption">PENGAR IN</div>
        <h1 id="setup-heading">Vad får du in varje månad?</h1>
        <p className="setup-lead">Lägg in din lön eller annan återkommande inkomst. Det hjälper appen att räkna ut din budget dag för dag.</p>
        {income.length > 0 && <div className="setup-existing">
          <strong>Redan inlagt</strong>
          {income.map(item => <div key={item.id}>{item.label}<strong>{money(item.amountOre)}</strong></div>)}
        </div>}
        <form className="setup-form" onSubmit={event => save(event, "income")}>
          <label>Beskrivning<input required maxLength={90} value={incomeLabel} onChange={e => setIncomeLabel(e.target.value)} placeholder="Till exempel lön" /></label>
          <label>Inkomst per månad (kr)<input inputMode="decimal" required placeholder="30 000" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} /></label>
          <button disabled={blocked} className="button button-primary setup-primary" type="submit">{blocked ? "Sparar …" : "Spara och fortsätt →"}</button>
        </form>
        <button className="setup-text-button" disabled={blocked} onClick={() => go("costs")} type="button">
          {income.length ? "Fortsätt utan fler inkomster" : "Hoppa över inkomst"}
        </button>
      </div>}

      {step === "costs" && <div className="setup-content">
        <div className="mini-caption">PENGAR UT</div>
        <h1 id="setup-heading">Vilka fasta kostnader har du?</h1>
        <p className="setup-lead">Lägg in till exempel hyra, el eller abonnemang. Du kan lägga till flera och ändra dem senare under Inställningar.</p>
        {costs.length > 0 && <div className="setup-existing">
          <strong>Inlagda kostnader</strong>
          {costs.map(item => <div key={item.id}>{item.label}<strong>{money(item.amountOre)}</strong></div>)}
        </div>}
        <form className="setup-form" onSubmit={event => save(event, "expense")}>
          <label>Kostnad<input required maxLength={90} value={costLabel} onChange={e => setCostLabel(e.target.value)} placeholder="Till exempel hyra" /></label>
          <label>Belopp per månad (kr)<input inputMode="decimal" required placeholder="7 500" value={costAmount} onChange={e => setCostAmount(e.target.value)} /></label>
          <button disabled={blocked} className="button button-secondary setup-primary" type="submit">{blocked ? "Sparar …" : "+ Spara kostnad"}</button>
        </form>
        <button type="button" disabled={blocked} className="button button-primary setup-primary" onClick={() => go("start")}>
          {costs.length ? "Fortsätt →" : "Fortsätt utan fasta kostnader →"}
        </button>
        <button type="button" className="setup-text-button" disabled={blocked} onClick={() => go("income")}>Tillbaka</button>
      </div>}

      {step === "start" && <div className="setup-content">
        <div className="mini-caption">EN GÅNG VID STARTEN</div>
        <h1 id="setup-heading">Hur mycket har du kvar just nu?</h1>
        <p className="setup-lead">Ange pengarna du kan använda resten av den här månaden. Fasta räkningar du redan betalat ska inte dras igen. Har du obetalda räkningar kvar denna månad, dra av dem innan du anger beloppet.</p>
        <p>Vi delar beloppet på dagarna som återstår. Nästa månad börjar din vanliga månadsbudget automatiskt, baserad på inkomster och fasta kostnader. Sparat överskott höjer aldrig nästa månads dagsbudget.</p>
        <form className="setup-form" onSubmit={saveStart}>
          <label>Kvar att spendera (kr)<input required inputMode="decimal" value={startAmount}
            onChange={e => setStartAmount(e.target.value)} placeholder="Till exempel 8 000" /></label>
          <button disabled={blocked} className="button button-primary setup-primary" type="submit">{blocked ? "Sparar …" : "Spara startsaldo →"}</button>
        </form>
        <button type="button" className="setup-text-button" disabled={blocked} onClick={() => go("start")}>Tillbaka till startsaldo</button>
      </div>}

      {step === "ready" && <div className="setup-content">
        <div className="setup-emoji" aria-hidden="true">🎉</div>
        <h1 id="setup-heading">Nu är du redo!</h1>
        <p className="setup-lead">Varje dag har du en dagsbudget. När du lägger in en utgift ser du hur dagens resultat förändras. Den här första månaden delar vi pengarna du har kvar på dagarna som återstår. Från nästa månad bygger dagsbudgeten på dina inkomster minus fasta kostnader. Tidigare månaders resultat sparas i historiken, men läggs inte till nästa månads budget.</p>
        <div className="setup-steps-summary">
          <div><span>✓</span> {income.length} {income.length === 1 ? "inkomst" : "inkomster"} inlagda</div>
          <div><span>✓</span> {costs.length} fasta {costs.length === 1 ? "kostnad" : "kostnader"} inlagda</div>
          <div><span>✓</span> Startsaldo används bara första månaden</div>
          <div><span>✓</span> Budgeten sparas i Firebase</div>
        </div>
        <button type="button" className="button button-primary setup-primary" disabled={blocked} onClick={finish}>
          {blocked ? "Sparar …" : "Lägg till min första utgift →"}
        </button>
        <button className="setup-text-button" type="button" disabled={blocked} onClick={() => go("costs")}>Tillbaka till kostnader</button>
      </div>}

      {error && <p role="alert" className="setup-error">{error}</p>}
      {message && !["Sparat i Firebase.", "Uppdaterad från Firebase.", "Sparar i Firebase …"].includes(message)
        && <p className="setup-error" role="alert">{message}</p>}

      <footer className="setup-footer">
        <span>Allt sparas i Firebase. Du kan ändra uppgifterna senare.</span>
        {onClose
          ? <button type="button" className="setup-link" disabled={blocked} onClick={onClose}>Stäng guiden</button>
          : <span>Du kan hoppa över inkomster och kostnader, men behöver ange ett startbelopp (0 kr går bra).</span>}
      </footer>
    </section>
  </main>;
}
