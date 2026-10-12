import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBudget } from "../src/lib/budget.ts";
import { updateExpense } from "../src/lib/expense-edits.ts";

const source = createEmptyBudget("2026-10-12");
const expense = {
  id: "tx-1", workspaceId: "personal", memberId: "owner",
  label: "Kaffe", amountOre: -3500, bookedOn: "2026-10-12",
  createdAt: "2026-10-12T09:00:00Z",
};
source.transactions = [expense, {
  id: "tx-2", workspaceId: "personal", memberId: "owner",
  label: "Lunch", amountOre: -10900, bookedOn: "2026-10-12",
  createdAt: "2026-10-12T12:00:00Z",
}];
test("editing a Firestore expense replaces exactly one record without new history", () => {
  const updated = updateExpense(source, expense, {
    amount: "42,50", label: "Fika", bookedOn: "2026-10-11",
  });
  assert.equal(updated.transactions.length, 2);
  assert.deepEqual(source.transactions[0], expense, "original Firestore snapshot stays unchanged");
  assert.deepEqual(updated.transactions[0], {
    ...expense, label: "Fika", amountOre: -4250, bookedOn: "2026-10-11",
  });
  assert.deepEqual(updated.transactions[1], source.transactions[1], "other transactions are preserved");
});
test("editing never turns an expense into income or removes its original identifier", () => {
  const updated = updateExpense(source, expense, {
    amount: "100", label: "", bookedOn: expense.bookedOn,
  });
  assert.equal(updated.transactions[0].id, expense.id);
  assert.equal(updated.transactions[0].amountOre, -10000);
  assert.equal(updated.transactions[0].label, "Utgift");
  assert.equal(updated.transactions[0].createdAt, expense.createdAt);
});
test("invalid values and stale concurrent edits are rejected", () => {
  const unchanged = { amount: "1", label: "Ny", bookedOn: expense.bookedOn };
  assert.throws(() => updateExpense(source, expense, {...unchanged, amount: "0"}), /giltigt belopp/);
  assert.throws(() => updateExpense(source, expense, {...unchanged, bookedOn: "2026-02-30"}), /giltigt datum/);
  assert.throws(() => updateExpense(source, expense, {...unchanged, label: "x".repeat(91)}), /90 tecken/);
  const newer = { ...source, transactions: [{...expense, amountOre: -3000}] };
  assert.throws(() => updateExpense(newer, expense, unchanged), /annan enhet/);
  assert.throws(() => updateExpense({...source,transactions:[]}, expense, unchanged), /finns inte längre/);
});
