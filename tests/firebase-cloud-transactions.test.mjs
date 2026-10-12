import test from "node:test";
import assert from "node:assert/strict";
import { createDemoBudget, createEmptyBudget } from "../src/lib/budget.ts";
import { prepareCloudChange } from "../src/lib/cloud-updates.ts";

test("Firebase change adds an expense without mutating its input snapshot", () => {
  const before = createEmptyBudget("2026-10-12");
  const next = prepareCloudChange(before, budget => ({
    ...budget,
    transactions: [...budget.transactions, {
      id: "test-1", workspaceId: "personal", memberId: "owner", label: "Synktest",
      amountOre: -100, bookedOn: "2026-10-12", createdAt: "2026-10-12T19:00:00Z",
    }],
  }));
  assert.equal(before.transactions.length, 0);
  assert.equal(next.transactions.length, 1);
  assert.equal(next.transactions[0].label, "Synktest");
});
test("consecutive edits compose against the latest confirmed budget", () => {
  const first = prepareCloudChange(createEmptyBudget("2026-10-12"), budget => ({
    ...budget, workspaces: budget.workspaces.map(w => ({ ...w, openingBalanceOre: 10000 })),
  }));
  const second = prepareCloudChange(first, budget => ({
    ...budget, workspaces: budget.workspaces.map(w => ({ ...w, name: "Hushåll" })),
  }));
  assert.equal(second.workspaces[0].openingBalanceOre, 10000);
  assert.equal(second.workspaces[0].name, "Hushåll");
});
test("invalid or demo changes cannot be sent to the cloud", () => {
  const original = createEmptyBudget("2026-10-12");
  assert.throws(() => prepareCloudChange(original, () => createDemoBudget("2026-10-12")), /Ogiltiga budgetdata/);
  assert.throws(() => prepareCloudChange(original, () => null), /Ogiltiga budgetdata/);
});
