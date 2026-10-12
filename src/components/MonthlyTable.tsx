"use client";

import { useEffect, useMemo, useState } from "react";
import { type BudgetDocument } from "@/lib/budget";
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
  onAddTransaction: (date: string) => void;
};

export function MonthlyTable({ document, workspaceId, today, onAddTransaction }: Props) {
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { setMonth(today.slice(0, 7)); }, [today]);
  const ledger = useMemo(() => getMonthLedger(document, workspaceId, month), [document, workspaceId, month]);
  const isForecast = ledger.end > today;
  const monthIsBeforeStart = ledger.total.balanceOre === null;
  const isCurrentMonth = month === today.slice(0, 7);

  function navigate(offset: number) {
    setMonth(previous => shiftMonth(previous, offset));
    setExpanded(null);
  }
  return (
    <section className="month-view" aria-label="Budget dag för dag">
      <div className="panel month-toolbar">
        <div>
          <div className="mini-caption">VARJE DAG RÄKNAS</div>
          <h2>Dag för dag</h2>
          <p>Se vad varje dag tillför och vad dina köp kostar.</p>
        </div>
        <div className="month-picker">
          <button type="button" className="month-control" onClick={() => navigate(-1)} aria-label="Föregående månad">‹</button>
          <strong aria-live="polite">{formatMonth(month)}</strong>
          <button type="button" className="month-control" onClick={() => navigate(1)} aria-label="Nästa månad">›</button>
          {!isCurrentMonth && <button type="button" className="month-today" onClick={() => { setMonth(today.slice(0, 7)); setExpanded(null); }}>Denna månad</button>}
        </div>
      </div>
      <div className="month-summary">
        <div className="month-kpi">
          <span>{isForecast ? "Resultat inkl. prognos" : "Månadens resultat"}</span>
          <strong className={ledger.total.dailyResultOre >= 0 ? "positive" : "negative"}>{signed(ledger.total.dailyResultOre)}</strong>
        </div>
        <div className="month-kpi">
          <span>Registrerade händelser</span>
          <strong className={ledger.total.variableNetOre >= 0 ? "positive" : "negative"}>{signed(ledger.total.variableNetOre)}</strong>
        </div>
        <div className="month-kpi">
          <span>Budgetsaldo vid månadsslut</span>
          <strong>{monthIsBeforeStart ? "Ej startad" : amount(ledger.total.balanceOre ?? 0)}</strong>
        </div>
      </div>
      <div className="panel month-panel">
        <div className="month-table-intro">
          <span><i className="month-dot past" /> Genomförd dag</span>
          <span><i className="month-dot today" /> Idag</span>
          <span><i className="month-dot future" /> Prognos</span>
          <span className="month-mobile-hint">Tryck på en dag för att se registrerade händelser</span>
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
                        onClick={() => setExpanded(open ? null : row.date)}>
                        <span className="month-day-label">
                          <span>{formatDay(row.date)}</span>
                          {isToday && <span className="day-pill">Idag</span>}
                          {future && <span className="day-future">Plan</span>}
                        </span>
                        <span className="day-chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
                      </button>
                    </th>
                    <td className={`num ${row.variableNetOre >= 0 ? "positive" : "negative"}`}>{row.active ? signed(row.variableNetOre) : "–"}</td>
                    <td className={`num total-day ${row.dailyResultOre >= 0 ? "positive" : "negative"}`}>{row.active ? signed(row.dailyResultOre) : "–"}</td>
                    <td className="num running-balance">{row.balanceOre === null ? "–" : amount(row.balanceOre)}</td>
                  </tr>,
                  open && <tr key={row.date + "-details"} className="month-details-row"><td colSpan={4}>
                    {!row.active ? <p>Budgeten börjar efter detta datum.</p> : <>
                      <div className="month-details-header"><strong>{row.date} · {detailsCount === 0 ? "Inga poster" : `${detailsCount} poster`}</strong>
                        <button type="button" className="month-add" onClick={() => onAddTransaction(row.date)}>+ Registrera händelse denna dag</button>
                      </div>
                      {row.transactions.map(t =>
                        <div className="month-detail" key={t.id}><span>{t.label} <small>registrerad händelse</small></span><strong>{signed(t.amountOre)}</strong></div>)}
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
      <div className="bottom-hint"><span>ⓘ</span>
        <span>{isForecast
          ? "Framtida dagar är prognoser baserade på fasta poster och redan registrerade händelser. Ytterligare köp ingår inte."
          : "Budgetsaldo är ett beräknat saldo, inte ditt bankkontosaldo."}
          {" "}Fasta inkomster och kostnader ingår i dagsresultatet, men visas inte separat. Klicka på en dag för att se registrerade händelser.</span>
      </div>
    </section>
  );
}
