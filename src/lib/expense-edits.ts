import {
  type BudgetDocument, type Transaction, kronaToOre, utcDay,
} from "./budget.ts";

export type ExpenseChange = {
  amount: string;
  label: string;
  bookedOn: string;
};

/**
 * Change a single signed transaction against the latest Firestore document.
 * Preserve identity, sign and creation timestamp, and reject concurrent edits.
 * Expenses and one-time income use the same conflict-safe editing logic.
 */
function updateSignedTransaction(
  document: BudgetDocument, original: Transaction, change: ExpenseChange,
  kind: "expense" | "income",
): BudgetDocument {
  const amount = kronaToOre(change.amount);
  if (!amount) throw new Error("Ange ett giltigt belopp större än noll.");
  const label = change.label.trim() || (kind === "income" ? "Engångsinkomst" : "Utgift");
  if (label.length > 90) throw new Error("Beskrivningen får vara högst 90 tecken.");
  try { utcDay(change.bookedOn); }
  catch { throw new Error("Ange ett giltigt datum."); }

  const current = document.transactions.find(item => item.id === original.id);
  const expectedSign = kind === "income" ? 1 : -1;
  if (!current || Math.sign(current.amountOre) !== expectedSign || Math.sign(original.amountOre) !== expectedSign) {
    throw new Error((kind === "income" ? "Inkomsten" : "Utgiften") + " finns inte längre. Ladda om listan.");
  }
  if (current.label !== original.label ||
      current.amountOre !== original.amountOre ||
      current.bookedOn !== original.bookedOn) {
    throw new Error((kind === "income" ? "Inkomsten" : "Utgiften") + " har ändrats på en annan enhet. Kontrollera den senaste versionen.");
  }
  const workspace = document.workspaces.find(w => w.id === current.workspaceId);
  if (kind === "income" && workspace && change.bookedOn < workspace.anchorOn) {
    throw new Error("Datumet kan inte vara före budgetens start.");
  }

  return {
    ...document,
    transactions: document.transactions.map(item => item.id === original.id
      ? { ...item, amountOre: expectedSign * amount, label, bookedOn: change.bookedOn }
      : item),
  };
}

/** Historical export retained for existing callers and tests. */
export function updateExpense(
  document: BudgetDocument, original: Transaction, change: ExpenseChange,
): BudgetDocument {
  return updateSignedTransaction(document, original, change, "expense");
}

export function updateOneTimeIncome(
  document: BudgetDocument, original: Transaction, change: ExpenseChange,
): BudgetDocument {
  return updateSignedTransaction(document, original, change, "income");
}
