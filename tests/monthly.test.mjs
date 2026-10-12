import test from "node:test";
import assert from "node:assert/strict";
import { addDays, createEmptyBudget, dailyResultOre, virtualBalanceOre } from "../src/lib/budget.ts";
import { getMonthLedger, shiftMonth } from "../src/lib/monthly.ts";

test("month navigation handles year boundaries", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2024-02", 12), "2025-02");
  assert.throws(() => shiftMonth("2026-13", 1));
});
test("calendar ledger has every day, even leap day and 30-day months", () => {
  const doc = createEmptyBudget("2024-02-01");
  const feb = getMonthLedger(doc, "personal", "2024-02");
  assert.equal(feb.days.length, 29);
  assert.equal(feb.days[0].date, "2024-02-01");
  assert.equal(feb.days.at(-1).date, "2024-02-29");
  assert.equal(getMonthLedger(doc, "personal", "2026-04").days.length, 30);
  assert.equal(getMonthLedger(doc, "personal", "2026-10").days.length, 31);
});
test("each day reconciles fixed net, variable events and running budget balance", () => {
  const doc = createEmptyBudget("2026-10-01");
  doc.workspaces[0].openingBalanceOre = 50000;
  doc.recurring = [
    { id:"income", workspaceId:"personal", memberId:"owner", label:"Lön",
      amountOre:3000000, cadence:"monthly", startsOn:"2026-10-01", endsOn:null },
    { id:"rent", workspaceId:"personal", memberId:"owner", label:"Hyra",
      amountOre:-900000, cadence:"monthly", startsOn:"2026-10-01", endsOn:null },
  ];
  doc.transactions = [
    { id:"tx1", workspaceId:"personal", memberId:"owner", label:"Kaffe", amountOre:-5600, bookedOn:"2026-10-01", createdAt:"2026-10-01" },
    { id:"tx2", workspaceId:"personal", memberId:"owner", label:"Extra", amountOre:12000, bookedOn:"2026-10-01", createdAt:"2026-10-01" },
    { id:"tx3", workspaceId:"personal", memberId:"owner", label:"Mat", amountOre:-34500, bookedOn:"2026-10-14", createdAt:"2026-10-14" },
    { id:"other", workspaceId:"other", memberId:null, label:"Annan", amountOre:-999999, bookedOn:"2026-10-01", createdAt:"2026-10-01" },
  ];
  const month = getMonthLedger(doc, "personal", "2026-10");
  assert.equal(month.days.length, 31);
  assert.equal(month.days[0].transactions.length, 2);
  assert.equal(month.days[0].variableNetOre, 6400);
  assert.equal(month.days[13].variableNetOre, -34500);
  for (const row of month.days) {
    assert.equal(row.dailyResultOre, dailyResultOre(doc, "personal", row.date));
    assert.equal(row.balanceOre, virtualBalanceOre(doc, "personal", row.date));
    assert.equal(row.recurringIncomeOre + row.recurringExpensesOre + row.variableNetOre, row.dailyResultOre);
  }
  assert.equal(month.total.dailyResultOre, month.days.reduce((sum, r) => sum + r.dailyResultOre, 0));
  assert.equal(month.total.balanceOre, virtualBalanceOre(doc, "personal", month.end));
  assert.equal(month.total.variableNetOre, -28100);
});
test("periods before the budget anchor show no generated balances or history", () => {
  const doc = createEmptyBudget("2026-10-12");
  doc.workspaces[0].openingBalanceOre = 123400;
  const sep = getMonthLedger(doc, "personal", "2026-09");
  assert.ok(sep.days.every(row => !row.active && row.balanceOre === null));
  assert.equal(sep.total.balanceOre, null);
  const oct = getMonthLedger(doc, "personal", "2026-10");
  assert.ok(oct.days.slice(0, 11).every(row => !row.active && row.balanceOre === null));
  assert.equal(oct.days[11].balanceOre, 123400);
  assert.equal(oct.days.at(-1).balanceOre, 123400);
});
test("a recurring change mid-month only affects rows from its effective date", () => {
  const doc = createEmptyBudget("2026-10-01");
  doc.recurring = [
    { id:"old", workspaceId:"personal", memberId:null, label:"Lön", amountOre:1000000,
      cadence:"monthly", startsOn:"2026-10-01", endsOn:"2026-10-14" },
    { id:"new", workspaceId:"personal", memberId:null, label:"Lön", amountOre:2000000,
      cadence:"monthly", startsOn:"2026-10-15", endsOn:null },
  ];
  const october = getMonthLedger(doc, "personal", "2026-10");
  assert.equal(october.days[13].recurring[0].item.id, "old");
  assert.equal(october.days[14].recurring[0].item.id, "new");
  assert.ok(october.days[14].dailyResultOre > october.days[13].dailyResultOre);
});
