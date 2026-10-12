"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MonthlyTable } from "@/components/MonthlyTable";
import {
  type BudgetDocument, type Cadence, type Recurring, type Transaction,
  addDays, createDemoBudget, createEmptyBudget, dailyNetOre, dailyResultOre,
  kronaToOre, mondayOnOrBefore, rangeResultOre, replaceRecurringFrom, todayLocal,
  validDocument, virtualBalanceOre,
} from "@/lib/budget";

type Tab = "overview" | "monthly" | "transactions" | "recurring" | "settings";
type EntryType = "expense" | "income";
const STORAGE_KEY = "budget-app:v1";
const currency = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 });
const asMoney = (ore: number) => currency.format(ore / 100);
const signedMoney = (ore: number) => (ore > 0 ? "+" : "") + asMoney(ore);
const formatDate = (day: string) => new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(day + "T00:00:00Z"));
const cadenceLabel: Record<Cadence, string> = {
  weekly: "Varje vecka",
  monthly: "Varje månad",
  quarterly: "Varje kvartal",
  yearly: "Varje år",
};
const nav: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Översikt", icon: "▦" },
  { id: "monthly", label: "Månadsvy", icon: "▤" },
  { id: "transactions", label: "Händelser", icon: "⇄" },
  { id: "recurring", label: "Återkommande", icon: "↻" },
  { id: "settings", label: "Inställningar", icon: "⚙" },
];

function Trend({ document, workspaceId, today }: { document: BudgetDocument; workspaceId: string; today: string }) {
  const points = useMemo(() => Array.from({ length: 60 }, (_, index) => {
    const day = addDays(today, index - 29);
    return { day, ore: virtualBalanceOre(document, workspaceId, day) };
  }), [document, workspaceId, today]);
  const values = points.map((p) => p.ore / 100);
  const low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * 0.14, 250);
  const min = low - padding, max = high + padding;
  const width = 760, height = 250, top = 24, bottom = 212;
  const x = (index: number) => 16 + index * (width - 32) / (points.length - 1);
  const y = (value: number) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const past = points.slice(0, 30).map((p, i) => `${i ? "L" : "M"} ${x(i).toFixed(2)} ${y(p.ore / 100).toFixed(2)}`).join(" ");
  const future = points.slice(29).map((p, i) => `${i ? "L" : "M"} ${x(i + 29).toFixed(2)} ${y(p.ore / 100).toFixed(2)}`).join(" ");
  const area = `${past} L ${x(29)} ${bottom} L ${x(0)} ${bottom} Z`;
  return (
    <div className="trend">
      <svg viewBox="0 0 760 250" role="img" aria-label="Beräknat budgetsaldos utveckling senaste 30 dagarna och prognos 30 dagar framåt">
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16a184" stopOpacity=".24" />
            <stop offset="100%" stopColor="#16a184" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map(i => {
          const level = min + (max - min) * i / 4;
          return <g key={i}>
            <line x1="16" y1={y(level)} x2="744" y2={y(level)} stroke="#e7eced" strokeDasharray="4 7" />
            <text x="740" y={y(level) - 7} textAnchor="end" className="axis-label">{Math.round(level).toLocaleString("sv-SE")} kr</text>
          </g>;
        })}
        <path d={area} fill="url(#chart-fill)" />
        <path d={past} stroke="#09896f" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={future} stroke="#09896f" opacity=".5" strokeWidth="3" strokeDasharray="6 8" fill="none" strokeLinecap="round" />
        <line x1={x(29)} x2={x(29)} y1="15" y2={bottom} stroke="#64748b" strokeDasharray="3 5" strokeWidth="1.4" />
        <circle cx={x(29)} cy={y(points[29].ore / 100)} r="6" fill="#09896f" stroke="white" strokeWidth="3" />
        <text x="18" y="239" className="axis-label">{formatDate(points[0].day)}</text>
        <text x={x(29)} y="239" textAnchor="middle" className="axis-label">Idag</text>
        <text x="742" y="239" textAnchor="end" className="axis-label">{formatDate(points[59].day)}</text>
      </svg>
      <div className="chart-legend"><span><i className="legend-dot" /> Historik</span><span><i className="legend-dash" /> Prognos utan framtida köp</span></div>
    </div>
  );
}

export default function HomePage() {
  const [document, setDocument] = useState<BudgetDocument | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [currentDay, setCurrentDay] = useState("2026-10-12");
  const [notice, setNotice] = useState("");
  const [txLabel, setTxLabel] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<EntryType>("expense");
  const [txDate, setTxDate] = useState("");
  const [recLabel, setRecLabel] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recType, setRecType] = useState<EntryType>("expense");
  const [recCadence, setRecCadence] = useState<Cadence>("monthly");
  const [recStart, setRecStart] = useState("");
  const [opening, setOpening] = useState("0");
  const [workspaceName, setWorkspaceName] = useState("Min ekonomi");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const today = todayLocal();
    setCurrentDay(today);
    setTxDate(today);
    setRecStart(today);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setDocument(createDemoBudget(today));
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (validDocument(parsed)) {
        setDocument(parsed);
      } else {
        setNotice("Sparad data har ett okänt format. Demo visas tills du återställer en säkerhetskopia.");
        setDocument(createDemoBudget(today));
      }
    } catch {
      setNotice("Kunde inte läsa sparad data. Demo visas tills du importerar en säkerhetskopia.");
      setDocument(createDemoBudget(today));
    }
  }, []);
  useEffect(() => {
    if (document) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  }, [document]);
  const workspace = document?.workspaces[0];
  const workspaceId = workspace?.id ?? "personal";
  const currentBalance = document ? virtualBalanceOre(document, workspaceId, currentDay) : 0;
  const dailyNet = document ? dailyNetOre(document, workspaceId, currentDay) : 0;
  const todayResult = document ? dailyResultOre(document, workspaceId, currentDay) : 0;
  const weekResult = document ? rangeResultOre(document, workspaceId, mondayOnOrBefore(currentDay), currentDay) : 0;
  const monthResult = document ? rangeResultOre(document, workspaceId, currentDay.slice(0, 7) + "-01", currentDay) : 0;
  const nextMonthBalance = document ? virtualBalanceOre(document, workspaceId, addDays(currentDay, 30)) : 0;
  const activeRecurring = useMemo(() => document?.recurring.filter(r => r.workspaceId === workspaceId && r.endsOn === null) ?? [], [document, workspaceId]);
  const historicalRecurring = useMemo(() => document?.recurring.filter(r => r.workspaceId === workspaceId && r.endsOn !== null) ?? [], [document, workspaceId]);
  const transactions = useMemo(() => (document?.transactions ?? []).filter(t => t.workspaceId === workspaceId)
    .sort((a, b) => b.bookedOn.localeCompare(a.bookedOn) || b.createdAt.localeCompare(a.createdAt)), [document, workspaceId]);

  function mutate(update: (value: BudgetDocument) => BudgetDocument) {
    setDocument(prev => prev ? update(prev) : prev);
  }
  function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = kronaToOre(txAmount);
    if (!document || !amount || !txLabel.trim() || !txDate) {
      setNotice("Fyll i beskrivning, datum och ett giltigt belopp över noll."); return;
    }
    const row: Transaction = {
      id: crypto.randomUUID(), workspaceId, memberId: document.members[0]?.id ?? null,
      label: txLabel.trim(), amountOre: txType === "expense" ? -amount : amount,
      bookedOn: txDate, createdAt: new Date().toISOString(),
    };
    mutate(d => ({ ...d, transactions: [...d.transactions, row] }));
    setTxLabel(""); setTxAmount(""); setNotice("Händelsen har registrerats.");
  }
  function addRecurring(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = kronaToOre(recAmount);
    if (!document || !amount || !recLabel.trim() || !recStart) {
      setNotice("Fyll i beskrivning, startdatum och ett giltigt belopp över noll."); return;
    }
    const row: Recurring = {
      id: crypto.randomUUID(), workspaceId, memberId: document.members[0]?.id ?? null,
      label: recLabel.trim(), amountOre: recType === "expense" ? -amount : amount,
      cadence: recCadence, startsOn: recStart, endsOn: null,
    };
    mutate(d => ({ ...d, recurring: [...d.recurring, row] }));
    setRecLabel(""); setRecAmount(""); setNotice("Den återkommande posten har lagts till.");
  }
  function changeRecurring(item: Recurring) {
    const raw = window.prompt("Nytt belopp i kronor (ange utan minustecken). Ändringen gäller från idag.", String(Math.abs(item.amountOre) / 100));
    if (raw === null) return;
    const ore = kronaToOre(raw);
    if (!ore) { setNotice("Ogiltigt belopp."); return; }
    if (item.startsOn > currentDay) { setNotice("Denna post börjar i framtiden. Avsluta den och skapa en ny i stället."); return; }
    mutate(d => replaceRecurringFrom(d, item.id, currentDay, Math.sign(item.amountOre) * ore));
    setNotice("Ny version sparad. Historiken har behållits.");
  }
  function endRecurring(item: Recurring) {
    if (!window.confirm("Avsluta " + item.label + "? Tidigare historik bevaras.")) return;
    mutate(d => ({ ...d, recurring: item.startsOn >= currentDay
      ? d.recurring.filter(r => r.id !== item.id)
      : d.recurring.map(r => r.id === item.id ? { ...r, endsOn: addDays(currentDay, -1) } : r) }));
    setNotice("Posten har avslutats.");
  }
  function deleteTransaction(id: string) {
    if (!window.confirm("Ta bort händelsen?")) return;
    mutate(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }));
  }
  function clearDemo() {
    if (!window.confirm("Börja med en helt tom budget? Demouppgifterna tas bort.")) return;
    const empty = createEmptyBudget(currentDay);
    setDocument(empty);
    setOpening("0"); setWorkspaceName("Min ekonomi");
    setNotice("Nu har du en tom, personlig budget.");
  }
  function exportBackup() {
    if (!document) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `budget-app-backup-${currentDay}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validDocument(parsed)) throw new Error("Ogiltigt backupformat");
      if (!window.confirm("Ersätta den nuvarande budgeten med säkerhetskopian?")) return;
      setDocument(parsed);
      setNotice("Säkerhetskopian har återställts.");
    } catch { setNotice("Filen är inte en giltig Budget App-säkerhetskopia."); }
    finally { event.target.value = ""; }
  }
  function saveWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = opening.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^-?\d+(\.\d{1,2})?$/.test(normalized) || !workspaceName.trim()) {
      setNotice("Ange ett giltigt namn och startsaldo."); return;
    }
    const ore = Math.round(Number(normalized) * 100);
    if (!Number.isSafeInteger(ore)) { setNotice("För stort belopp."); return; }
    mutate(d => ({ ...d, workspaces: d.workspaces.map(w => w.id === workspaceId
      ? { ...w, name: workspaceName.trim(), openingBalanceOre: ore } : w) }));
    setNotice("Inställningarna har sparats.");
  }
  useEffect(() => {
    if (workspace) {
      setOpening(String(workspace.openingBalanceOre / 100));
      setWorkspaceName(workspace.name);
    }
  }, [workspace?.id, workspace?.openingBalanceOre, workspace?.name]);

  if (!document || !workspace) return <main className="loading">Laddar din budget …</main>;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">◈</div><div><strong>budget<span>.</span></strong><small>ETT DRAG I TAGET</small></div></div>
        <div className="sidebar-caption">MIN EKONOMI</div>
        <nav className="nav" aria-label="Huvudmeny">
          {nav.map(item => <button type="button" key={item.id} onClick={() => { setTab(item.id); setNotice(""); }}
            className={tab === item.id ? "nav-item active" : "nav-item"}>
            <span className="nav-symbol">{item.icon}</span>{item.label}
          </button>)}
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-avatar">J</div><div><strong>Personlig budget</strong><small>Privat på den här enheten</small></div></div>
      </aside>
      <div className="main-shell">
        <header className="mobile-head"><div className="brand"><div className="brand-mark">◈</div><strong>budget<span>.</span></strong></div><span className="mobile-lock">⌁ Lokal data</span></header>
        <nav className="mobile-nav" aria-label="Huvudmeny">
          {nav.map(item => <button type="button" key={item.id} onClick={() => { setTab(item.id); setNotice(""); }}
            className={tab === item.id ? "mobile-nav-item selected" : "mobile-nav-item"}>{item.label}</button>)}
        </nav>
        <main className="main">
          <div className="title-row">
            <div><div className="eyebrow">{formatDate(currentDay).toUpperCase()} · {workspace.name.toUpperCase()}</div><h1>{tab === "overview" ? "Din ekonomi, i klartext." : nav.find(n => n.id === tab)?.label}</h1>
              <p className="lead">{tab === "overview" ? "Ett dagligt resultat. Små beslut som blir stora över tid." :
                tab === "monthly" ? "Varje dag i månaden, samlad på ett ställe." :
                tab === "transactions" ? "Registrera det som händer mellan löningarna." :
                tab === "recurring" ? "Grunden som driver ditt dagliga ekonomiska netto." :
                "Din data, din kontroll."}</p></div>
            <div className="top-actions"><span className="privacy-pill">● Endast på enheten</span>{document.demo && <span className="demo-pill">DEMODATA</span>}</div>
          </div>
          {notice && <div className="notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Stäng meddelande">×</button></div>}
          {document.demo && <div className="demo-notice"><div><strong>Du tittar på en demo.</strong> Alla siffror är påhittade. Börja med en tom budget när du vill lägga in din egen ekonomi.</div><button type="button" onClick={clearDemo} className="button button-outline">Börja med min budget →</button></div>}
          {tab === "overview" && <>
            <section className="hero-grid">
              <div className="hero-main">
                <div className="hero-overline">DAGLIGT GRUNDNETTO <span className="info-circle" title="Fasta inkomster och utgifter fördelade över årets dagar">i</span></div>
                <div className={dailyNet >= 0 ? "hero-number" : "hero-number negative"}>{signedMoney(dailyNet)}<span>/dag</span></div>
                <p>Din ekonomi tickar {dailyNet >= 0 ? "uppåt" : "nedåt"} varje dag, innan rörliga köp.</p>
                <div className="hero-stripe"><span>✦</span> Varje dag är en ny tur.</div>
              </div>
              <div className="hero-side">
                <div className="mini-caption">BERÄKNAT BUDGETSALDO</div>
                <div className="balance-figure">{asMoney(currentBalance)}</div>
                <p>Virtuellt saldo sedan {formatDate(workspace.anchorOn)}, inte pengar på banken.</p>
                <div className="small-divider" />
                <div className="mini-caption">OM 30 DAGAR</div>
                <div className="future-figure">{asMoney(nextMonthBalance)} <span>{signedMoney(nextMonthBalance - currentBalance)}</span></div>
                <p>Om du inte registrerar fler rörliga utgifter.</p>
              </div>
            </section>
            <section className="metric-grid" aria-label="Periodresultat">
              <div className="metric"><div className="metric-label">Idag <span>↗</span></div><div className={todayResult >= 0 ? "metric-value positive" : "metric-value negative"}>{signedMoney(todayResult)}</div><p>Inkl. dagens registrerade köp</p></div>
              <div className="metric"><div className="metric-label">Denna vecka <span>↗</span></div><div className={weekResult >= 0 ? "metric-value positive" : "metric-value negative"}>{signedMoney(weekResult)}</div><p>Från måndag till idag</p></div>
              <div className="metric"><div className="metric-label">Denna månad <span>↗</span></div><div className={monthResult >= 0 ? "metric-value positive" : "metric-value negative"}>{signedMoney(monthResult)}</div><p>Från månadens början</p></div>
            </section>
            <div className="section-grid">
              <section className="panel chart-panel">
                <div className="panel-heading"><div><div className="mini-caption">DIN RIKTNING</div><h2>Ekonomins utveckling</h2></div><span className="subtle-tag">30 dagar bakåt + 30 framåt</span></div>
                <Trend document={document} workspaceId={workspaceId} today={currentDay} />
              </section>
              <section className="panel activity-panel">
                <div className="panel-heading"><div><div className="mini-caption">DET SOM HÄNDER</div><h2>Senaste händelser</h2></div><button className="text-button" type="button" onClick={() => setTab("transactions")}>Visa alla ↗</button></div>
                {transactions.length === 0 ? <div className="empty-small">Inga köp ännu. Registrera ett för att börja.</div> :
                  transactions.slice(0, 5).map(t => <div className="activity" key={t.id}><div className={t.amountOre >= 0 ? "activity-icon gain" : "activity-icon"}>{t.amountOre >= 0 ? "↗" : "↙"}</div><div className="activity-name"><strong>{t.label}</strong><small>{formatDate(t.bookedOn)}</small></div><strong className={t.amountOre >= 0 ? "positive" : ""}>{signedMoney(t.amountOre)}</strong></div>)}
                <button className="button button-primary activity-cta" type="button" onClick={() => setTab("transactions")}>+ Registrera en händelse</button>
              </section>
            </div>
            <div className="bottom-hint"><span>ⓘ</span> Prognosen bygger på fasta poster. Framtida mat, resor och andra rörliga utgifter ingår inte förrän du registrerar dem.</div>
          </>}
          {tab === "monthly" && <MonthlyTable document={document} workspaceId={workspaceId} today={currentDay}
            onAddTransaction={(date) => { setTxDate(date); setTab("transactions"); setNotice(""); }} />}
          {tab === "transactions" && <div className="two-columns">
            <section className="panel form-panel"><div className="mini-caption">NY HÄNDELSE</div><h2>Vad har hänt?</h2>
              <form onSubmit={addTransaction} className="form">
                <label>Typ <select value={txType} onChange={e => setTxType(e.target.value as EntryType)}><option value="expense">Utgift</option><option value="income">Extra inkomst</option></select></label>
                <label>Beskrivning <input required maxLength={90} placeholder="Exempel: Handla mat" value={txLabel} onChange={e => setTxLabel(e.target.value)} /></label>
                <label>Belopp i kronor <input required inputMode="decimal" placeholder="249,50" value={txAmount} onChange={e => setTxAmount(e.target.value)} /></label>
                <label>Datum <input required type="date" value={txDate} onChange={e => setTxDate(e.target.value)} /></label>
                <button className="button button-primary" type="submit">Spara händelse →</button>
              </form><p className="form-hint">Fasta räkningar ska bara finnas under Återkommande, annars räknas de dubbelt.</p>
            </section>
            <section className="panel list-panel"><div className="panel-heading"><div><div className="mini-caption">DIN HISTORIK</div><h2>Registrerade händelser</h2></div><span className="subtle-tag">{transactions.length} st</span></div>
              {transactions.length === 0 ? <div className="empty-state">Här kommer dina köp och extra inkomster att visas.</div> : transactions.map(t => <div className="list-row" key={t.id}>
                <div><strong>{t.label}</strong><small>{formatDate(t.bookedOn)}</small></div>
                <div className="list-row-right"><strong className={t.amountOre >= 0 ? "positive" : "negative"}>{signedMoney(t.amountOre)}</strong><button className="icon-button" type="button" title="Ta bort händelse" aria-label={"Ta bort " + t.label} onClick={() => deleteTransaction(t.id)}>×</button></div>
              </div>)}
            </section>
          </div>}
          {tab === "recurring" && <div className="two-columns">
            <section className="panel form-panel"><div className="mini-caption">DIN GRUND</div><h2>Ny återkommande post</h2>
              <form onSubmit={addRecurring} className="form">
                <label>Typ <select value={recType} onChange={e => setRecType(e.target.value as EntryType)}><option value="expense">Fast utgift</option><option value="income">Fast inkomst</option></select></label>
                <label>Beskrivning <input required maxLength={90} placeholder="Exempel: Lön eller hyra" value={recLabel} onChange={e => setRecLabel(e.target.value)} /></label>
                <label>Belopp per tillfälle (kr) <input required inputMode="decimal" placeholder="12000" value={recAmount} onChange={e => setRecAmount(e.target.value)} /></label>
                <label>Hur ofta? <select value={recCadence} onChange={e => setRecCadence(e.target.value as Cadence)}>
                  <option value="weekly">Varje vecka</option><option value="monthly">Varje månad</option><option value="quarterly">Varje kvartal</option><option value="yearly">Varje år</option></select></label>
                <label>Gäller från <input required type="date" value={recStart} onChange={e => setRecStart(e.target.value)} /></label>
                <button className="button button-primary" type="submit">Lägg till post →</button>
              </form><p className="form-hint">Beloppet jämnas ut över årets dagar. Utbetalningsdatum styr inte dagsnettot.</p>
            </section>
            <section className="panel list-panel"><div className="panel-heading"><div><div className="mini-caption">AUTOMATISKT VARJE DAG</div><h2>Fasta inkomster & utgifter</h2></div><span className="subtle-tag">{activeRecurring.length} aktiva</span></div>
              {activeRecurring.length === 0 ? <div className="empty-state">Lägg till lön, hyra eller ett abonnemang för att skapa ditt dagsnetto.</div> :
                activeRecurring.map(r => <div className="list-row recurring-row" key={r.id}>
                  <div><strong>{r.label}</strong><small>{cadenceLabel[r.cadence]} · från {formatDate(r.startsOn)}</small></div>
                  <div className="rec-actions"><strong className={r.amountOre >= 0 ? "positive" : "negative"}>{signedMoney(r.amountOre)}</strong>
                    <button type="button" className="quiet-button" onClick={() => changeRecurring(r)}>Ändra</button>
                    <button type="button" className="quiet-button danger-link" onClick={() => endRecurring(r)}>Avsluta</button></div>
                </div>)}
              {historicalRecurring.length > 0 && <details className="archived"><summary>Avslutade och tidigare versioner ({historicalRecurring.length})</summary>
                {historicalRecurring.map(r => <div key={r.id} className="archived-row">{r.label}: {signedMoney(r.amountOre)} · {r.startsOn} till {r.endsOn}</div>)}</details>}
            </section>
          </div>}
          {tab === "settings" && <div className="two-columns">
            <section className="panel form-panel"><div className="mini-caption">GRUNDINSTÄLLNINGAR</div><h2>Din budget</h2>
              <form className="form" onSubmit={saveWorkspace}>
                <label>Namn på din ekonomi <input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} maxLength={70} /></label>
                <label>Virtuellt startsaldo (kr) <input inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)} /></label>
                <div className="form-hint">Startdatum: {formatDate(workspace.anchorOn)}. Startsaldo är en budgetposition, inte ett verifierat banksaldo. Ändringar av startsaldot påverkar hela den beräknade historiken.</div>
                <button className="button button-primary" type="submit">Spara inställningar →</button>
              </form>
            </section>
            <section className="panel form-panel"><div className="mini-caption">ENDAST PÅ DIN ENHET</div><h2>Data och säkerhetskopior</h2>
              <p className="settings-copy">Just nu sparas allt lokalt i webbläsaren. Ingen information synkroniseras mellan enheter eller skickas till GitHub.</p>
              <div className="settings-actions"><button type="button" className="button button-secondary" onClick={exportBackup}>↓ Exportera JSON-backup</button>
                <button type="button" className="button button-outline" onClick={() => fileRef.current?.click()}>↑ Importera backup</button>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden-file" onChange={importBackup} /></div>
              <p className="form-hint">Använd bara betrodda enheter. Lokal data kan försvinna om webbläsarens lagring rensas. Spara regelbundna säkerhetskopior.</p>
              <button type="button" className="danger-button" onClick={clearDemo}>Börja om med tom budget</button>
            </section>
          </div>}
        </main>
      </div>
    </div>
  );
}
