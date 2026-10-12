import {
  type BudgetDocument, type Transaction, kronaToOre, utcDay,
} from "./budget.ts";

export type ExpenseChange = {
  amount: string;
  label: string;
  bookedOn: string;
};

/**
 * Update just one expense in the latest Firestore budget. Preserve its id,
 * creation timestamp and membership. Reject stale edits instead of silently
 * overwriting a concurrent correction made on another device.
 */
export function updateExpense(
  document: BudgetDocument, original: Transaction, change: ExpenseChange,
): BudgetDocument {
  const amount = kronaToOre(change.amount);
  if (!amount) throw new Error("Ange ett giltigt belopp större än noll.");
  const label = change.label.trim() || "Utgift";
  if (label.length > 90) throw new Error("Beskrivningen får vara högst 90 tecken.");
  try { utcDay(change.bookedOn); }
  catch { throw new Error("Ange ett giltigt datum."); }

  const current = document.transactions.find(item => item.id === original.id);
  if (!current || current.amountOre >= 0) {
    throw new Error("Utgiften finns inte längre. Ladda om listan.");
  }
  if (current.label !== original.label ||
      current.amountOre !== original.amountOre ||
      current.bookedOn !== original.bookedOn) {
    throw new Error("Utgiften har ändrats på en annan enhet. Kontrollera den senaste versionen.");
  }

  return {
    ...document,
    transactions: document.transactions.map(item => item.id === original.id
      ? { ...item, amountOre: -amount, label, bookedOn: change.bookedOn }
      : item),
  };
}
