"use client";

import { useEffect, useMemo, useState } from "react";
import { type BudgetDocument, type Transaction } from "@/lib/budget";
import { ExpenseEditor } from "@/components/ExpenseEditor";
import { type ExpenseChange } from "@/lib/expense-edits";
import { getMonthLedger, shiftMonth } from "@/lib/monthly";

const sek = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 2 });
const amount = (ore: number) => sek.format(ore / 100);
const signed = (ore: number) => (ore > 0 ? "+" : "") + amount(ore);
const weekdays = new Intl.DateTimeFormat("sv-SE", { weekday: "short", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric", timeZone: "UTC" });
const dateStamp = (day: string) => new Date(day + "T00:00:00Z");
const formatMonth = (month: string) => monthLabel.format(dateStamp(month + "-01"));
const formatDay = (day: string) => `${weekdays.format(dateStamp(day))} ${Number(day.slice(-2))}`;

type Props = {
  document: BudgetDocument;
  workspaceId: string;
  today: string;
  onEditTransaction: (transaction: Transaction, changes: ExpenseChange) => Promise<boolean>;
  saving: boolean;
};

export function MonthlyTable({ document, workspaceId, today, onEditTransaction, saving }: Props) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => { setMonth(today.slice(0, 7)); }, [today]);
  const ledger = useMemo(() => getMonthLedger(document, workspaceId, month), [document, workspaceId, month]);
  const history = useMemo(() => {
    const workspace = document.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return [];
    const result: { month: string; resultOre: number }[] = [];
    const thisMonth = today.slice(0, 7);
    let cursor = workspace.anchorOn.slice(0, 7);
    for (let count = 0; count < 240 && cursor < thisMonth; count++) {
      const entry = getMonthLedger(document, workspaceId, cursor);
      result.push({ month: cursor, resultOre: entry.total.dailyResultOre });
      cursor = shiftMonth(cursor, 1);
    }
    return result;
  }, [document, workspaceId, today]);
  const historicTotalOre = history.reduce((sum, entry) => sum + entry.resultOre, 0);
  const monthIsBeforeStart = ledger.total.balanceOre === null;
  const isCurrentMonth = month === today.slice(0, 7);

  function navigate(offset: number) {
    setMonth(previous => shiftMonth(previous, offset));
    setExpanded(null);
    setEditingId(null);
  }
  return (
    <section className="month-view" aria-label="Budget dag för dag">
      <div className="panel month-toolbar">
        <div className="month-picker">
          <button type="button" className="month-control" onClick={() => navigate(-1)} aria-label="Föregående månad">‹</button>
          <strong aria-live="polite">{formatMonth(month)}</strong>
          <button type="button" className="month-control" onClick={() => navigate(1)} aria-label="Nästa månad">›</button>
          {!isCurrentMonth && <button type="button" className="month-today" onClick={() => { setMonth(today.slice(0, 7)); setExpanded(null); setEditingId(null); }}>Denna månad</button>}
        </div>
      </div>
      <div className="panel month-panel">
        <div className="month-table-intro">
          <span><i className="month-dot past" /> Genomförd dag</span>
          <span><i className="month-dot today" /> Idag</span>
          <span><i className="month-dot future" /> Kommande dag</span>
          <span className="month-mobile-hint">Tryck på en dag för att se eller ändra dina utgifter.</span>
        </div>
        <div className="month-scroll" role="region" aria-label={formatMonth(month) + " – budgettabell"} tabIndex={0}>
          <table className="month-table">
            <caption className="visually-hidden">Daglig ekonomisk sammanställning för {formatMonth(month)}. Belopp i kronor.</caption>
            <thead><tr>
              <th scope="col">Datum</th>
              <th scope="col" className="num">Registrerat</th>
              <th scope="col" className="num">Dagsresultat</th>
              <th scope="col" className="num">Budgetsaldo</th>
            </tr></thead>
            <tbody>
              {ledger.days.map(row => {
                const future = row.date > today;
                const isToday = row.date === today;
                const open = expanded === row.date;
                const detailsCount = row.transactions.length;
                return [
                  <tr key={row.date} className={[
                    "month-data-row", future ? "is-future" : "", isToday ? "is-today" : "",
                    !row.active ? "is-before-anchor" : "", open ? "is-expanded" : "",
                  ].filter(Boolean).join(" ")}>
                    <th scope="row">
                      <button type="button" className="month-day-button" aria-expanded={open}
                        aria-label={`${formatDay(row.date)}: ${open ? "dölj" : "visa"} detaljer`}
                        onClick={() => { setExpanded(open ? null : row.date); setEditingId(null); }}>
                        <span className="day-chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
                        <span className="month-day-label">
                          <span>{formatDay(row.date)}</span>
                          {isToday && <span className="day-pill">Idag</span>}
                          {future && <span className="day-future">Plan</span>}
                        </span>
                      </button>
                    </th>
                    <td className={`num ${row.variableNetOre >= 0 ? "positive" : "negative"}`}>{row.active ? signed(row.variableNetOre) : "–"}</td>
                    <td className={`num total-day ${row.dailyResultOre >= 0 ? "positive" : "negative"}`}>{row.active ? signed(row.dailyResultOre) : "–"}</td>
                    <td className="num running-balance">{row.balanceOre === null ? "–" : amount(row.balanceOre)}</td>
                  </tr>,
                  open && <tr key={row.date + "-details"} className="month-details-row"><td colSpan={4}>
                    {!row.active ? <p>Budgeten börjar efter detta datum.</p> : <>
                      <div className="month-details-header"><strong>{row.date} · {detailsCount === 0 ? "Inga poster" : `${detailsCount} poster`}</strong>
                      </div>
                      {row.transactions.map(t =>
                        <div className="month-expense-item" key={t.id}>
                          <div className="month-detail">
                            <span>{t.label} <small>registrerad händelse</small></span>
                            <div className="month-detail-actions">
                              <strong>{signed(t.amountOre)}</strong>
                              {t.amountOre < 0 && <button type="button" className="quiet-button expense-edit-trigger"
                                disabled={saving} aria-expanded={editingId === t.id}
                                onClick={() => setEditingId(current => current === t.id ? null : t.id)}>Ändra</button>}
                            </div>
                          </div>
                          {editingId === t.id && <ExpenseEditor transaction={t} saving={saving}
                            onSave={onEditTransaction} onCancel={() => setEditingId(null)} />}
                        </div>)}
                      {detailsCount === 0 && <p>Inga registrerade händelser denna dag.</p>}
                    </>}
                  </td></tr>
                ];
              })}
            </tbody>
            <tfoot><tr>
              <th scope="row">Summa</th>
              <td className={`num ${ledger.total.variableNetOre >= 0 ? "positive" : "negative"}`}>{signed(ledger.total.variableNetOre)}</td>
              <td className={`num ${ledger.total.dailyResultOre >= 0 ? "positive" : "negative"}`}>{signed(ledger.total.dailyResultOre)}</td>
              <td className="num">{monthIsBeforeStart ? "–" : amount(ledger.total.balanceOre ?? 0)}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>
      {history.length > 0 && <details className="panel" style={{ padding: "1rem" }}>
        <summary>Resultat från tidigare månader ({history.length})</summary>
        <p>Resultaten är historik. De läggs aldrig till nästa månads dagsbudget.</p>
        <div className="fixed-list">
          {history.map(entry => <div className="list-row" key={entry.month}>
            <span>{formatMonth(entry.month)}</span>
            <strong className={entry.resultOre >= 0 ? "positive" : "negative"}>{signed(entry.resultOre)}</strong>
          </div>)}
          <div className="list-row"><strong>Samlat resultat</strong>
            <strong className={historicTotalOre >= 0 ? "positive" : "negative"}>{signed(historicTotalOre)}</strong>
          </div>
        </div>
      </details>}
    </section>
  );
}
