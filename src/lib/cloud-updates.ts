import { type BudgetDocument, validDocument } from "./budget.ts";

export function prepareCloudChange(
  previous: BudgetDocument, change: (budget: BudgetDocument) => BudgetDocument,
): BudgetDocument {
  // Keep the original snapshot immutable. Firestore can retry a transaction.
  const draft = JSON.parse(JSON.stringify(previous)) as BudgetDocument;
  const updated = change(draft);
  if (!validDocument(updated) || updated.demo) throw new Error("Ogiltiga budgetdata. Inget sparades.");
  if (JSON.stringify(updated).length > 790000) {
    throw new Error("Budgeten är för stor för molnlagringen.");
  }
  return updated;
}

