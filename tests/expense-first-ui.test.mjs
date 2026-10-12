import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyBudget, dailyNetOre, dailyResultOre, kronaToOre } from "../src/lib/budget.ts";

const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
test("expense-first layout exposes precisely three destinations", () => {
  const nav = page.match(/const nav:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.deepEqual([...nav.matchAll(/id: "([^"]+)"/g)].map(x => x[1]), ["monthly", "today", "settings"]);
  assert.match(page, /Lägg till utgift/);
  assert.match(page, /Dagens utgifter/);
});
test("settings host monthly income and fixed-cost forms without a separate recurring page", () => {
  assert.match(page, /Min inkomst/);
  assert.match(page, /Fasta kostnader/);
  assert.match(page, /addFixed\(event, "income"\)/);
  assert.match(page, /addFixed\(event, "expense"\)/);
  assert.match(page, /cadence: "monthly"/);
  assert.doesNotMatch(page, /tab === "recurring"/);
});
test("income and fixed cost contribute to daily budget while a purchase reduces it", () => {
  const doc = createEmptyBudget("2026-10-12");
  doc.recurring = [
    { id: "salary", label: "Lön", amountOre: 3000000, cadence: "monthly", startsOn: "2026-10-12", endsOn: null, workspaceId: "personal", memberId: "owner" },
    { id: "rent", label: "Hyra", amountOre: -800000, cadence: "monthly", startsOn: "2026-10-12", endsOn: null, workspaceId: "personal", memberId: "owner" },
  ];
  doc.transactions = [
    { id: "lunch", label: "Lunch", amountOre: -12000, bookedOn: "2026-10-12", workspaceId: "personal", memberId: "owner", createdAt: "2026-10-12T18:00:00Z" },
  ];
  assert.equal(dailyResultOre(doc,"personal","2026-10-12"),dailyNetOre(doc,"personal","2026-10-12")-12000);
  assert.equal(kronaToOre("120,50"),12050);
});

test("today's expenses open by default; monthly expansion chevron stays beside date", () => {
  const month = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/app/month.css", import.meta.url), "utf8");
  assert.match(page, /useState<Tab>\("today"\)/);
  const labelIndex = month.indexOf('<span className="month-day-label">');
  const arrowIndex = month.indexOf('<span className="day-chevron"');
  assert.ok(arrowIndex >= 0 && labelIndex > arrowIndex, "arrow should precede date text inside the same clickable button");
  assert.match(styles, /\.month-day-button\{display:inline-flex;justify-content:flex-start/);
  assert.match(styles, /\.month-table thead th:first-child,\.month-table tbody \.month-data-row th:first-child/);
});

test("new expense view displays live daily result above the expense form", () => {
  const start = page.indexOf('{tab === "new" && <div className="simple-home">');
  const result = page.indexOf('className="day-result-card"', start);
  const expense = page.indexOf('className="panel quick-expense-panel"', start);
  assert.ok(start >= 0 && result > start && expense > result, "Daily result should appear above expense entry");
  assert.match(page, /dailyResultOre\(document, workspaceId, expenseDay\)/);
  assert.match(page, /selectedDayResult < 0 \? " is-negative" : ""/);
  assert.match(page, /selectedDayResult > 0 \? "\+" : ""/);
  assert.match(page, /useState<Tab>\("today"\)/, "Today's expenses remains the default view");
});


test("UX: date refreshes on app foreground without changing a manually selected historical date", () => {
  assert.match(page, /window\.document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(page, /window\.addEventListener\("focus", refreshDay\)/);
  assert.match(page, /setExpenseDay\(previous => previous === lastToday \? current : previous\)/);
  assert.match(page, /window\.document\.removeEventListener\("visibilitychange", onVisibilityChange\)/);
});
test("UX: result follows selected date, date remains accessible and amount is focused", () => {
  assert.match(page, /dailyResultOre\(document, workspaceId, expenseDay\)/);
  assert.match(page, /RESULTAT FÖR VALD DAG/);
  assert.match(page, /<details className="expense-date-options" open=\{!isTodayExpense\}>/);
  assert.match(page, /ref=\{amountInput\} id="expense-amount"/);
});
test("UX: reduce status clutter, enlarge mobile controls, and explain month scrolling", () => {
  const stylesheet = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const monthMarkup = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  assert.match(page, /includes\(cloud\.message\) \? "" : cloud\.message/);
  assert.match(stylesheet, /\.icon-button\{min-width:44px;width:44px;height:44px/);
  assert.match(stylesheet, /\.mobile-nav-item\{min-height:44px\}/);
  assert.match(monthMarkup, /Svep tabellen i sidled/);
});
