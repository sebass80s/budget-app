"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CloudPanel } from "@/components/CloudPanel";
import { ExpenseEditor } from "@/components/ExpenseEditor";
import { Onboarding } from "@/components/Onboarding";
import {
  addSetupEntry, finishOnboarding, needsOnboarding, setInitialTurnsBalance, startMonthlyTurnsForExisting, type SetupKind,
} from "@/lib/onboarding";
import { type ExpenseChange, updateExpense, updateOneTimeIncome } from "@/lib/expense-edits";
import { addOneTimeIncome } from "@/lib/one-time-income";
import { MonthlyTable } from "@/components/MonthlyTable";
import { useCloudSync } from "@/hooks/useCloudSync";
import {
  type BudgetDocument, type Cadence, type Recurring, type Transaction,
  addDays, createEmptyBudget, dailyResultOre, kronaToOre, nextMonth, remainingMonthBudgetOre, replaceRecurringFrom, todayLocal,
  validDocument,
} from "@/lib/budget";

type Tab = "new" | "monthly" | "settings";
type FixedKind = "income" | "expense";

const nav: { id: Tab; label: string; icon: string }[] = [
  { id: "new", label: "Hem", icon: "⌂" },
  { id: "monthly", label: "Månadsvy", icon: "▤" },
  { id: "settings", label: "Inställningar", icon: "⚙" },
];
const currency = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 2 });
const money = (ore: number) => currency.format(ore / 100);
const formatDay = (day: string) => new Intl.DateTimeFormat("sv-SE", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
}).format(new Date(day + "T00:00:00Z"));
const cadenceLabel: Record<Cadence, string> = {
  weekly: "Varje vecka", monthly: "Varje månad",
  quarterly: "Varje kvartal", yearly: "Varje år",
};

export default function HomePage() {
  const cloud = useCloudSync();
  const document = cloud.budget;
  const workspace = document?.workspaces[0];
  const workspaceId = workspace?.id ?? "personal";
  const [tab, setTab] = useState<Tab>("new");
  const [today, setToday] = useState("2026-10-12");
  const [expenseDay, setExpenseDay] = useState("2026-10-12");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [incomeOnceAmount, setIncomeOnceAmount] = useState("");
  const [incomeOnceDescription, setIncomeOnceDescription] = useState("");
  const [incomeOnceDay, setIncomeOnceDay] = useState("2026-10-12");
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [editingTodayId, setEditingTodayId] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [incomeLabel, setIncomeLabel] = useState("Lön");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [fixedLabel, setFixedLabel] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Min ekonomi");
  const [opening, setOpening] = useState("0");
  const [existingStart, setExistingStart] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let lastToday = todayLocal();
    setToday(lastToday);
    setExpenseDay(lastToday);
    setIncomeOnceDay(lastToday);
    // Installed iPhone PWAs can stay mounted across midnight.
    const refreshDay = () => {
      const current = todayLocal();
      if (current === lastToday) return;
      setToday(current);
      setExpenseDay(previous => previous === lastToday ? current : previous);
      setIncomeOnceDay(previous => previous === lastToday ? current : previous);
      lastToday = current;
    };
    const onVisibilityChange = () => {
      if (!window.document.hidden) refreshDay();
    };
    window.document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refreshDay);
    return () => {
      window.document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refreshDay);
    };
  }, []);
  useEffect(() => {
    if (tab === "new") amountInput.current?.focus({ preventScroll: true });
  }, [tab]);
  useEffect(() => {
    if (!workspace) return;
    setWorkspaceName(workspace.name);
    setOpening(String(workspace.openingBalanceOre / 100));
  }, [workspace?.id, workspace?.name, workspace?.openingBalanceOre]);

  const todaysExpenses = useMemo(() => (document?.transactions ?? [])
    .filter(t => t.workspaceId === workspaceId && t.bookedOn === today && t.amountOre < 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [document, today, workspaceId]);
  const todaysTotal = todaysExpenses.reduce((sum, item) => sum + Math.abs(item.amountOre), 0);
  const todaysIncomes = useMemo(() => (document?.transactions ?? [])
    .filter(t => t.workspaceId === workspaceId && t.bookedOn === today && t.amountOre > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [document, today, workspaceId]);
  const selectedDayResult = document ? dailyResultOre(document, workspaceId, expenseDay) : 0;
  const remainingMonth = document ? remainingMonthBudgetOre(document, workspaceId, today) : 0;
  const isTodayExpense = expenseDay === today;
  const activeRecurring = useMemo(() => (document?.recurring ?? [])
    .filter(r => r.workspaceId === workspaceId && r.endsOn === null), [document, workspaceId]);
  const oldRecurring = useMemo(() => (document?.recurring ?? [])
    .filter(r => r.workspaceId === workspaceId && r.endsOn !== null), [document, workspaceId]);

  function show(tabId: Tab) { setTab(tabId); setNotice(""); }
  function newExpense(date = todayLocal()) {
    setExpenseDay(date);
    show("new");
    amountInput.current?.focus({ preventScroll: true });
  }

  async function addExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const ore = kronaToOre(amount);
    if (!document || !ore || !expenseDay) {
      setNotice("Ange ett giltigt belopp över noll.");
      return;
    }
    const item: Transaction = {
      id: crypto.randomUUID(),
      workspaceId,
      memberId: document.members[0]?.id ?? null,
      label: description.trim() || "Utgift",
      amountOre: -ore,
      bookedOn: expenseDay,
      createdAt: new Date().toISOString(),
    };
    if (await cloud.saveBudget(d => ({ ...d, transactions: [...d.transactions, item] }))) {
      setAmount("");
      setDescription("");
      setNotice("Utgiften är sparad i Firebase.");
    }
  }

  async function addExtraMoney(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (!document || !kronaToOre(incomeOnceAmount) || !incomeOnceDay) {
      setNotice("Ange ett giltigt belopp över noll.");
      return;
    }
    const entry = {
      id: crypto.randomUUID(), workspaceId, label: incomeOnceDescription,
      amount: incomeOnceAmount, bookedOn: incomeOnceDay,
      createdAt: new Date().toISOString(),
    };
    if (await cloud.saveBudget(doc => addOneTimeIncome(doc, entry))) {
      setIncomeOnceAmount("");
      setIncomeOnceDescription("");
      setNotice("Engångsinkomsten är sparad i Firebase.");
    }
  }

  async function saveSetupEntry(kind: SetupKind, label: string, amount: string): Promise<boolean> {
    const id = crypto.randomUUID();
    const day = todayLocal();
    return cloud.saveBudget(doc => addSetupEntry(doc, { kind, label, amount, day, id }));
  }

  async function saveStart(amount: string): Promise<boolean> {
    const day = todayLocal();
    return cloud.saveBudget(doc => setInitialTurnsBalance(doc, day, amount));
  }
  async function completeSetup(): Promise<boolean> {
    // Only new accounts have an unfinished Firebase onboarding marker.
    // Manually revisiting the guide never modifies existing account metadata.
    if (document && needsOnboarding(document)) {
      const saved = await cloud.saveBudget(finishOnboarding);
      if (!saved) return false;
    }
    setShowSetupGuide(false);
    setNotice("");
    setTab("new");
    return true;
  }

  async function addFixed(event: React.FormEvent<HTMLFormElement>, kind: FixedKind) {
    event.preventDefault();
    setNotice("");
    if (!document) return;
    const label = (kind === "income" ? incomeLabel : fixedLabel).trim();
    const ore = kronaToOre(kind === "income" ? incomeAmount : fixedAmount);
    if (!ore || !label) {
      setNotice("Ange en beskrivning och ett giltigt belopp.");
      return;
    }
    const item: Recurring = {
      id: crypto.randomUUID(),
      workspaceId,
      memberId: document.members[0]?.id ?? null,
      label,
      amountOre: kind === "income" ? ore : -ore,
      cadence: "monthly",
      startsOn: workspace?.turnsStart ? nextMonth(today) : today,
      endsOn: null,
    };
    if (await cloud.saveBudget(d => ({ ...d, recurring: [...d.recurring, item] }))) {
      if (kind === "income") { setIncomeLabel("Lön"); setIncomeAmount(""); }
      else { setFixedLabel(""); setFixedAmount(""); }
      setNotice(kind === "income" ? "Inkomsten är sparad i Firebase." : "Den fasta kostnaden är sparad i Firebase.");
    }
  }

  function editFixed(item: Recurring) {
    const input = window.prompt("Nytt belopp i kronor per tillfälle:", String(Math.abs(item.amountOre) / 100));
    if (input === null) return;
    const ore = kronaToOre(input);
    if (!ore) { setNotice("Ogiltigt belopp."); return; }
    const from = workspace?.turnsStart ? nextMonth(today) : item.startsOn > today ? item.startsOn : today;
    void cloud.saveBudget(d => replaceRecurringFrom(d, item.id, from, Math.sign(item.amountOre) * ore))
      .then(saved => { if (saved) setNotice("Beloppet är uppdaterat i Firebase."); });
  }

  function endFixed(item: Recurring) {
    if (!window.confirm("Avsluta " + item.label + "? Tidigare budgethistorik behålls.")) return;
    const endFrom = workspace?.turnsStart ? nextMonth(today) : today;
    void cloud.saveBudget(d => ({
      ...d,
      recurring: item.startsOn >= endFrom
        ? d.recurring.filter(r => r.id !== item.id)
        : d.recurring.map(r => r.id === item.id ? { ...r, endsOn: addDays(endFrom, -1) } : r),
    })).then(saved => { if (saved) setNotice("Posten har avslutats i Firebase."); });
  }

  async function saveExpenseEdit(original: Transaction, changes: ExpenseChange): Promise<boolean> {
    setNotice("");
    const saved = await cloud.saveBudget(doc => original.amountOre > 0
      ? updateOneTimeIncome(doc, original, changes) : updateExpense(doc, original, changes));
    if (saved) setNotice(original.amountOre > 0 ? "Engångsinkomsten har uppdaterats i Firebase." : "Utgiften har uppdaterats i Firebase.");
    return saved;
  }

  function deleteExpense(item: Transaction) {
    if (!window.confirm("Ta bort utgiften " + item.label + "?")) return;
    void cloud.saveBudget(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== item.id) }))
      .then(saved => { if (saved) setNotice("Utgiften har tagits bort."); });
  }

  function deleteOneTimeIncome(item: Transaction) {
    if (!window.confirm("Ta bort engångsinkomsten " + item.label + "?")) return;
    void cloud.saveBudget(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== item.id || t.amountOre <= 0) }))
      .then(saved => { if (saved) setNotice("Engångsinkomsten har tagits bort."); });
  }

  async function activateMonthlyTurns(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document || workspace?.turnsStart) return;
    if (!window.confirm("Vill du starta din dagsbudget idag? Vi delar beloppet du anger på dagarna som är kvar av månaden. Från nästa månad räknas dagsbudgeten ut från dina inkomster minus fasta kostnader. Dina tidigare resultat ändras inte.")) return;
    try {
      const changed=startMonthlyTurnsForExisting(document,todayLocal(),existingStart);
      if (await cloud.saveBudget(doc => startMonthlyTurnsForExisting(doc, changed.workspaces[0].turnsStart!.day,existingStart))) {
        setNotice("Din dagsbudget är igång. Beloppet gäller resten av den här månaden.");
      }
    } catch(error) {
      setNotice(error instanceof Error ? error.message : "Beloppet kunde inte sparas.");
    }
  }
  async function saveWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = opening.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^-?\d+(\.\d{1,2})?$/.test(normalized) || !workspaceName.trim()) {
      setNotice("Ange ett namn och giltigt startsaldo."); return;
    }
    const ore = Math.round(Number(normalized) * 100);
    if (!Number.isSafeInteger(ore)) { setNotice("Beloppet är för stort."); return; }
    if (await cloud.saveBudget(d => ({ ...d, workspaces: d.workspaces.map(w =>
      w.id === workspaceId ? { ...w, name: workspaceName.trim(), openingBalanceOre: w.turnsStart ? w.openingBalanceOre : ore } : w,
    ) }))) setNotice("Budgetinställningarna är sparade i Firebase.");
  }

  function exportBackup() {
    if (!document) return;
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "budget-app-backup-" + today + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validDocument(parsed) || parsed.demo) throw new Error("Ogiltigt format");
      if (!window.confirm("Ersätta din molnbudget med denna säkerhetskopia? Exportera gärna den nuvarande budgeten först.")) return;
      if (await cloud.saveBudget(() => parsed)) setNotice("Säkerhetskopian har återställts i Firebase.");
    } catch {
      setNotice("Filen är inte en giltig Budget App-säkerhetskopia.");
    } finally {
      event.target.value = "";
    }
  }
  async function resetBudget() {
    if (!window.confirm("Radera budgetens innehåll i Firebase och börja om? Exportera en säkerhetskopia först.")) return;
    if (await cloud.saveBudget(() => createEmptyBudget(today))) setNotice("En tom budget har skapats i Firebase.");
  }

  function FixedList({ kind }: { kind: FixedKind }) {
    const selected = activeRecurring.filter(r => kind === "income" ? r.amountOre > 0 : r.amountOre < 0);
    const historic = oldRecurring.filter(r => kind === "income" ? r.amountOre > 0 : r.amountOre < 0);
    return <>
      <div className="fixed-list" aria-label={kind === "income" ? "Sparade inkomster" : "Sparade fasta kostnader"}>
        {selected.length === 0 && <p className="empty-small">Inga poster inlagda ännu.</p>}
        {selected.map(item => <div className="list-row recurring-row" key={item.id}>
          <div><strong>{item.label}</strong><small>{cadenceLabel[item.cadence]} · från {formatDay(item.startsOn)}</small></div>
          <div className="rec-actions">
            <strong className={item.amountOre > 0 ? "positive" : "negative"}>{money(item.amountOre)}</strong>
            <div className="rec-buttons">
              <button disabled={cloud.status === "saving"} className="quiet-button" type="button" onClick={() => editFixed(item)}>Ändra</button>
              <button disabled={cloud.status === "saving"} className="quiet-button danger-link" type="button" onClick={() => endFixed(item)}>Avsluta</button>
            </div>
          </div>
        </div>)}
      </div>
      {historic.length > 0 && <details className="archived">
        <summary>Historik ({historic.length})</summary>
        {historic.map(item => <div className="archived-row" key={item.id}>
          {item.label} · {money(item.amountOre)} · {cadenceLabel[item.cadence]}
        </div>)}
      </details>}
    </>;
  }

  if (cloud.status === "loading") return <main className="loading">Hämtar din budget från Firebase …</main>;
  if (cloud.status !== "active" && cloud.status !== "saving") {
    return <main className="auth-screen">
      <div className="auth-layout">
        <div className="auth-intro">
          <div className="brand"><div className="brand-mark">◈</div><div><strong>Agile<span> Economy</span></strong><small>ETT DRAG I TAGET</small></div></div>
          <h1>En enklare vardagsekonomi.</h1>
          <p>Logga in så har du din budget på alla dina enheter.</p>
        </div>
        <CloudPanel cloud={cloud} mode="welcome" />
      </div>
    </main>;
  }
  if (!document || !workspace) return <main className="loading">Hämtar budget från Firebase …</main>;
  const cloudMessage = ["Sparat i Firebase.", "Uppdaterad från Firebase.", "Sparar i Firebase …"]
    .includes(cloud.message) ? "" : cloud.message;
  if (needsOnboarding(document) || showSetupGuide) {
    return <Onboarding document={document} saving={cloud.status === "saving"} message={cloud.message}
      onSaveEntry={saveSetupEntry} onFinish={completeSetup} onSaveStart={saveStart}
      onClose={needsOnboarding(document) ? undefined : () => setShowSetupGuide(false)} />;
  }

  return <div className="shell">
    <aside className="sidebar">
      <button type="button" className="brand brand-home" aria-label="Till registrera utgift" onClick={() => newExpense()}>
        <span className="brand-mark">◈</span><span><strong>Agile<span> Economy</span></strong><small>ETT DRAG I TAGET</small></span>
      </button>
      <button type="button" className={"menu-expense-action" + (tab === "new" ? " is-active" : "")} onClick={() => newExpense()}>+ Ny utgift</button>
      <div className="sidebar-caption">ÖVERSIKT</div>
      <nav className="nav" aria-label="Huvudmeny">
        {nav.map(item => <button type="button" key={item.id} onClick={() => item.id === "new" ? newExpense() : show(item.id)}
          className={tab === item.id ? "nav-item active" : "nav-item"}>
          <span className="nav-symbol">{item.icon}</span>{item.label}
        </button>)}
      </nav>
      <div className="sidebar-bottom"><span className="sidebar-avatar">✓</span>
        <span><strong>{workspace.name}</strong><small>{cloud.status === "saving" ? "Sparar i Firebase …" : "Firebase ansluten"}</small></span>
      </div>
    </aside>
    <div className="main-shell">
      <header className="mobile-head">
        <button type="button" className="brand brand-home" aria-label="Registrera en ny utgift" onClick={() => newExpense()}>
          <span className="brand-mark">◈</span><strong>Agile<span> Economy</span></strong>
        </button>
      </header>
      <nav className="mobile-nav" aria-label="Huvudmeny">
        {nav.map(item => <button type="button" key={item.id} onClick={() => item.id === "new" ? newExpense() : show(item.id)}
          className={tab === item.id ? "mobile-nav-item selected" : "mobile-nav-item"}>{item.label}</button>)}
      </nav>
      <main className="main">
        {tab !== "new" && <div className="title-row">
          <div><div className="eyebrow">{formatDay(today).toUpperCase()}</div>
            <h1>{nav.find(item => item.id === tab)?.label}</h1>
          </div>
          {tab !== "monthly" && <button type="button" className="button button-secondary" onClick={() => newExpense()}>+ Ny utgift</button>}
        </div>}
        {cloudMessage && <div className="notice notice-error" role="alert">{cloudMessage}</div>}
        {notice && <div className="notice" role="status">{notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Stäng meddelandet">×</button>
        </div>}

        {tab === "new" && <div className="simple-home">
          <section className="day-result-card" aria-labelledby="day-result-heading">
            <div className="mini-caption" id="day-result-heading">
              {isTodayExpense ? "DAGENS RESULTAT" : "RESULTAT FÖR VALD DAG"}
            </div>
            <div className={"day-result-amount" + (selectedDayResult < 0 ? " is-negative" : "")} aria-live="polite">
              {selectedDayResult > 0 ? "+" : ""}{money(selectedDayResult)}
            </div>
            <p>{formatDay(expenseDay)} · Dagsbudget plus extra pengar, minus registrerade utgifter. Startmånadens saldo gäller endast första månaden.</p>
          </section>
          <section className="day-result-card" aria-labelledby="month-result-heading">
            <div className="mini-caption" id="month-result-heading">KVAR ATT SPENDERA DENNA MÅNAD</div>
            <div className={"day-result-amount" + (remainingMonth < 0 ? " is-negative" : "")} aria-live="polite">
              {money(remainingMonth)}
            </div>
            <p>Hela månadens dagsbudget plus engångsinkomster, minus utgifterna hittills. Kommande dagars budget ingår. Detta är inte ditt banksaldo.</p>
          </section>
          <section className="panel quick-expense-panel" aria-labelledby="new-expense-heading">
            <div className="mini-caption">SNABBT OCH ENKELT</div>
            <h1 id="new-expense-heading" className="expense-heading">Lägg till utgift</h1>
            <form className="quick-expense-form" onSubmit={addExpense}>
              <label htmlFor="expense-amount">Belopp (kr)
                <input ref={amountInput} id="expense-amount" type="text" required inputMode="decimal"
                  autoComplete="off" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} />
              </label>
              <label htmlFor="expense-description">Namn på utgiften <span>(valfritt)</span>
                <input id="expense-description" type="text" maxLength={90}
                  placeholder="Till exempel lunch" value={description} onChange={e => setDescription(e.target.value)} />
              </label>
              <details className="expense-date-options" open={!isTodayExpense}>
                <summary>{isTodayExpense ? "Ändra datum (idag)" : "Datum: " + formatDay(expenseDay)}</summary>
                <label htmlFor="expense-date" className="expense-date-label">Datum för utgiften
                  <input id="expense-date" type="date" required value={expenseDay} onChange={e => setExpenseDay(e.target.value)} />
                </label>
              </details>
              <button disabled={cloud.status === "saving"} type="submit" className="button button-primary quick-submit">
                {cloud.status === "saving" ? "Sparar …" : "Spara utgift"}
              </button>
            </form>
            <p className="expense-save-hint">Utgiften visas när den har sparats i Firebase.</p>
          </section>
          <details className="panel one-time-income-panel">
            <summary>+ Lägg till extra pengar{todaysIncomes.length > 0 ? " (" + todaysIncomes.length + " idag)" : ""}</summary>
            <div className="one-time-income-content">
              <p>Har du fått extra pengar, till exempel en lottvinst? Lägg till beloppet här. Det ökar det du kan spendera den här månaden, men räknas inte som återkommande inkomst.</p>
              <form className="quick-expense-form" onSubmit={addExtraMoney}>
                <label htmlFor="income-once-amount">Belopp (kr)
                  <input id="income-once-amount" type="text" required inputMode="decimal"
                    autoComplete="off" placeholder="Till exempel 100" value={incomeOnceAmount}
                    onChange={e => setIncomeOnceAmount(e.target.value)} />
                </label>
                <label htmlFor="income-once-description">Vad fick du pengarna för? <span>(valfritt)</span>
                  <input id="income-once-description" type="text" maxLength={90}
                    placeholder="Till exempel lottvinst" value={incomeOnceDescription}
                    onChange={e => setIncomeOnceDescription(e.target.value)} />
                </label>
                <details className="expense-date-options" open={incomeOnceDay !== today}>
                  <summary>{incomeOnceDay === today ? "Ändra datum (idag)" : "Datum: " + formatDay(incomeOnceDay)}</summary>
                  <label htmlFor="income-once-date" className="expense-date-label">Datum för engångsinkomsten
                    <input id="income-once-date" type="date" required min={workspace.anchorOn}
                      value={incomeOnceDay} onChange={e => setIncomeOnceDay(e.target.value)} />
                  </label>
                </details>
                <button disabled={cloud.status === "saving"} type="submit" className="button button-primary quick-submit">
                  {cloud.status === "saving" ? "Sparar …" : "Lägg till pengarna"}
                </button>
              </form>
              {todaysIncomes.length > 0 && <div className="one-time-income-list">
                <h3>Extra pengar idag</h3>
                {todaysIncomes.map(item => <div className="expense-item" key={item.id}>
                  <div className="list-row">
                    <div><strong>{item.label}</strong><small>{formatDay(item.bookedOn)}</small></div>
                    <div className="list-row-right">
                      <strong className="positive">+{money(item.amountOre)}</strong>
                      <button type="button" className="quiet-button expense-edit-trigger"
                        disabled={cloud.status === "saving"} aria-expanded={editingIncomeId === item.id}
                        onClick={() => setEditingIncomeId(current => current === item.id ? null : item.id)}>
                        ✎ Ändra namn / belopp
                      </button>
                      <button type="button" disabled={cloud.status === "saving"} className="icon-button"
                        aria-label={"Ta bort " + item.label} title="Ta bort engångsinkomst"
                        onClick={() => deleteOneTimeIncome(item)}>×</button>
                    </div>
                  </div>
                  {editingIncomeId === item.id && <ExpenseEditor transaction={item}
                    saving={cloud.status === "saving"}
                    onSave={saveExpenseEdit} onCancel={() => setEditingIncomeId(null)} />}
                </div>)}
              </div>}
            </div>
          </details>
          <section className="panel list-panel">
            <div className="panel-heading"><h2>Dagens utgifter</h2><span className="subtle-tag">{todaysExpenses.length} st</span></div>
            {todaysExpenses.length === 0 ? <div className="empty-state">Du har inte registrerat några utgifter idag.</div> :
              todaysExpenses.map(item => <div className="expense-item" key={item.id}>
                <div className="list-row">
                  <div><strong>{item.label}</strong><small>{formatDay(item.bookedOn)}</small></div>
                  <div className="list-row-right">
                    <strong className="negative">{money(Math.abs(item.amountOre))}</strong>
                    <button type="button" className="quiet-button expense-edit-trigger"
                      aria-expanded={editingTodayId === item.id}
                      aria-controls={editingTodayId === item.id ? "edit-expense-" + item.id : undefined}
                      disabled={cloud.status === "saving"}
                      onClick={() => setEditingTodayId(current => current === item.id ? null : item.id)}>
                      ✎ Ändra namn / belopp
                    </button>
                    <button disabled={cloud.status === "saving"} className="icon-button" type="button"
                      aria-label={"Ta bort " + item.label} title="Ta bort utgift" onClick={() => deleteExpense(item)}>×</button>
                  </div>
                </div>
                {editingTodayId === item.id && <div id={"edit-expense-" + item.id}>
                  <ExpenseEditor transaction={item} saving={cloud.status === "saving"}
                    onSave={saveExpenseEdit} onCancel={() => setEditingTodayId(null)} />
                </div>}
              </div>)}
          </section>
        </div>}

        {tab === "monthly" && <MonthlyTable document={document} workspaceId={workspaceId} today={today}
          onEditTransaction={saveExpenseEdit}
          saving={cloud.status === "saving"} />}

        {tab === "settings" && <div className="settings-stack">
          <div className="settings-primary">
            <section className="panel form-panel">
              <div className="mini-caption">PENGAR IN</div>
              <h2>Min inkomst</h2>
              <form className="form" onSubmit={event => addFixed(event, "income")}>
                <label>Beskrivning <input required maxLength={90} value={incomeLabel}
                  onChange={e => setIncomeLabel(e.target.value)} placeholder="Lön" /></label>
                <label>Inkomst per månad (kr) <input required inputMode="decimal" value={incomeAmount}
                  onChange={e => setIncomeAmount(e.target.value)} placeholder="30 000" /></label>
                <button disabled={cloud.status === "saving"} className="button button-primary" type="submit">+ Lägg till inkomst</button>
              </form>
              <FixedList kind="income" />
            </section>
            <section className="panel form-panel">
              <div className="mini-caption">PENGAR UT VARJE MÅNAD</div>
              <h2>Fasta kostnader</h2>
              <form className="form" onSubmit={event => addFixed(event, "expense")}>
                <label>Vad gäller kostnaden? <input required maxLength={90} value={fixedLabel}
                  onChange={e => setFixedLabel(e.target.value)} placeholder="Till exempel hyra eller el" /></label>
                <label>Kostnad per månad (kr) <input required inputMode="decimal" value={fixedAmount}
                  onChange={e => setFixedAmount(e.target.value)} placeholder="7 500" /></label>
                <button disabled={cloud.status === "saving"} className="button button-primary" type="submit">+ Lägg till fast kostnad</button>
              </form>
              <FixedList kind="expense" />
            </section>
          </div>
          <p className="settings-explanation">Ändringar av inkomster och fasta kostnader börjar gälla nästa månad och skriver inte om avslutade månader. Dagsbudgeten nollställs vid månadsskiftet, men resultaten finns kvar i historiken.</p>
          {!workspace.turnsStart && <section className="panel form-panel">
            <div className="mini-caption">DIN DAGSBUDGET</div>
            <h2>Kom igång med din dagsbudget</h2>
            <p>Ange hur mycket pengar du har kvar att spendera den här månaden, efter räkningar som ännu inte är betalda. Vi delar beloppet på dagarna som återstår, så att du ser din budget för varje dag. Från nästa månad räknar appen automatiskt ut dagsbudgeten från dina inkomster minus fasta kostnader. Dina tidigare resultat ändras inte.</p>
            <form className="form" onSubmit={activateMonthlyTurns}>
              <label>Kvar att spendera denna månad (kr)<input required inputMode="decimal" value={existingStart}
                onChange={e => setExistingStart(e.target.value)} placeholder="Till exempel 8 000" /></label>
              <button disabled={cloud.status === "saving"} className="button button-primary" type="submit">Starta min dagsbudget</button>
            </form>
          </section>}
          <details className="panel settings-more">
            <summary>Fler inställningar</summary>
            <div className="settings-more-content">
              <section className="settings-support">
                <h2>Kom igång-guiden</h2>
                <p className="settings-copy">Vill du se introduktionen igen? Dina befintliga inkomster och kostnader finns kvar.</p>
                <button className="button button-outline" type="button" onClick={() => setShowSetupGuide(true)}>
                  Visa introduktionen
                </button>
              </section>
              <form className="form" onSubmit={saveWorkspace}>
                <h2>Budgetens inställningar</h2>
                <label>Namn på ekonomin <input required maxLength={70} value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} /></label>
                {!workspace.turnsStart && <label>Virtuellt startsaldo (kr) <input required inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)} /></label>}
                <p className="form-hint">Startdatum: {formatDay(workspace.anchorOn)}. {workspace.turnsStart ? "Första månadens startsaldo är låst och påverkar inte kommande månader." : "Detta är ett beräknat budgetsaldo, inte ditt banksaldo."}</p>
                <button disabled={cloud.status === "saving"} className="button button-secondary" type="submit">Spara budgetinställningar</button>
              </form>
              <section className="settings-support">
                <h2>Säkerhetskopia</h2>
                <p className="settings-copy">Din budget lagras i Firebase. Du kan spara en egen JSON-kopia vid behov.</p>
                <div className="settings-actions">
                  <button type="button" className="button button-secondary" onClick={exportBackup}>Exportera JSON</button>
                  <button type="button" className="button button-outline" onClick={() => fileInput.current?.click()}>Importera JSON</button>
                  <input ref={fileInput} type="file" accept=".json,application/json" className="hidden-file" onChange={importBackup} />
                </div>
              </section>
              <section className="settings-support">
                <h2>App och konto</h2>
                <p className="settings-copy">På iPhone kan appen läggas på hemskärmen via Safari → Dela → Lägg till på hemskärmen.</p>
                <CloudPanel cloud={cloud} />
              </section>
              <button type="button" className="danger-button" onClick={resetBudget}>Börja om med tom budget</button>
            </div>
          </details>
        </div>}
      </main>
    </div>
  </div>;
}
