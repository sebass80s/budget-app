import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyBudget, dailyResultOre, remainingMonthBudgetOre, virtualBalanceOre,
} from "../src/lib/budget.ts";
import { getMonthLedger } from "../src/lib/monthly.ts";
import { addOneTimeIncome } from "../src/lib/one-time-income.ts";
import { updateExpense, updateOneTimeIncome } from "../src/lib/expense-edits.ts";

function budget() {
  const doc = createEmptyBudget("2026-10-13");
  doc.workspaces[0].turnsStart = { day: "2026-10-13", availableOre: 800000 };
  doc.recurring = [{
    id: "salary", workspaceId: "personal", memberId: "owner", label: "Lön",
    amountOre: 3000000, cadence: "monthly", startsOn: "2026-11-01", endsOn: null,
  }];
  return doc;
}
const win = {
  id: "lottery-1", workspaceId: "personal", label: "Lottvinst",
  amount: "100", bookedOn: "2026-10-13", createdAt: "2026-10-13T12:00:00.000Z",
};

test("lottery win creates one positive event without changing recurring income or base budget", () => {
  const before = budget();
  const dayBefore = dailyResultOre(before, "personal", win.bookedOn);
  const after = addOneTimeIncome(before, win);
  assert.equal(after.transactions.length, 1);
  assert.equal(after.transactions[0].amountOre, 10000);
  assert.equal(after.transactions[0].label, "Lottvinst");
  assert.equal(after.transactions[0].bookedOn, "2026-10-13");
  assert.equal(after.transactions[0].id, win.id);
  assert.equal(after.transactions[0].memberId, "owner");
  assert.deepEqual(after.recurring, before.recurring);
  assert.deepEqual(after.workspaces, before.workspaces);
  assert.equal(before.transactions.length, 0);
  assert.equal(dailyResultOre(after, "personal", win.bookedOn), dayBefore + 10000);
  assert.equal(remainingMonthBudgetOre(after, "personal", "2026-10-13"), 810000);
  assert.equal(remainingMonthBudgetOre(after, "personal", "2026-10-14"), 810000);
  assert.equal(virtualBalanceOre(after, "personal", "2026-10-13"), dayBefore + 10000);
  assert.equal(remainingMonthBudgetOre(after, "personal", "2026-11-01"), 3000000);
  assert.equal(getMonthLedger(after, "personal", "2026-10").days[12].variableNetOre, 10000);
  assert.equal(getMonthLedger(after, "personal", "2026-11").days[0].variableNetOre, 0);
});

test("extra money works alongside expenses, without counting either twice", () => {
  const before = budget();
  before.transactions.push({
    id: "coffee", workspaceId: "personal", memberId: "owner", label: "Lunch",
    amountOre: -3000, bookedOn: "2026-10-13", createdAt: "2026-10-13T10:00:00Z",
  });
  const after = addOneTimeIncome(before, win);
  assert.equal(remainingMonthBudgetOre(after, "personal", "2026-10-13"), 807000);
  assert.equal(addOneTimeIncome(after, win), after, "Firestore transaction retry must be idempotent");
});

test("future-dated one-off income only changes results when the selected date arrives", () => {
  const doc = addOneTimeIncome(budget(), { ...win, bookedOn: "2026-10-15" });
  assert.equal(remainingMonthBudgetOre(doc, "personal", "2026-10-13"), 800000);
  assert.equal(remainingMonthBudgetOre(doc, "personal", "2026-10-15"), 810000);
});

test("income edits preserve the sign and identity while changing amount, name and date", () => {
  const before = addOneTimeIncome(budget(), win);
  const original = before.transactions[0];
  const after = updateOneTimeIncome(before, original, {
    amount: "150,50", label: "Skraplott", bookedOn: "2026-10-14",
  });
  assert.equal(after.transactions.length, 1);
  assert.deepEqual(after.transactions[0], { ...original, amountOre: 15050, label: "Skraplott", bookedOn: "2026-10-14" });
  assert.equal(remainingMonthBudgetOre(after, "personal", "2026-10-13"), 800000);
  assert.equal(remainingMonthBudgetOre(after, "personal", "2026-10-14"), 815050);
  assert.equal(before.transactions[0].amountOre, 10000);
  assert.throws(() => updateExpense(after, after.transactions[0], { amount: "50", label: "", bookedOn: "2026-10-14" }), /finns inte längre/);
  assert.throws(() => updateOneTimeIncome(after, original, { amount: "50", label: "", bookedOn: "2026-10-14" }), /annan enhet/);
});

test("invalid one-off incomes and backwards/incorrect edits cannot mutate account history", () => {
  const before = budget();
  for (const amount of ["0", "-5", "abc", "10.999"]) {
    assert.throws(() => addOneTimeIncome(before, { ...win, amount }), /giltigt belopp/);
  }
  assert.throws(() => addOneTimeIncome(before, { ...win, label: "x".repeat(91) }), /90 tecken/);
  assert.throws(() => addOneTimeIncome(before, { ...win, bookedOn: "2026-02-30" }), /giltigt datum/);
  assert.throws(() => addOneTimeIncome(before, { ...win, bookedOn: "2026-10-12" }), /före budgetens start/);
  assert.throws(() => addOneTimeIncome(before, { ...win, workspaceId: "other" }), /Budgeten finns inte/);
  assert.equal(before.transactions.length, 0);
  const withWin = addOneTimeIncome(before, { ...win, label: "" });
  assert.equal(withWin.transactions[0].label, "Engångsinkomst");
  assert.throws(() => updateOneTimeIncome(withWin, withWin.transactions[0], {
    amount: "200", label: "", bookedOn: "2026-10-12",
  }), /före budgetens start/);
});
