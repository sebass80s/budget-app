import {
  type BudgetDocument, type Transaction, kronaToOre, utcDay,
} from "./budget.ts";

/**
 * Book a one-time increase in the spendable budget.
 * It is deliberately a positive transaction, NEVER a recurring income.
 * The id is supplied by the caller so Firestore retries cannot duplicate it.
 */
export function addOneTimeIncome(
  document: BudgetDocument,
  args: {
    id: string;
    workspaceId: string;
    label: string;
    amount: string;
    bookedOn: string;
    createdAt: string;
  },
): BudgetDocument {
  const workspace = document.workspaces.find(w => w.id === args.workspaceId);
  if (!workspace) throw new Error("Budgeten finns inte.");
  if (!args.id) throw new Error("Inkomsten saknar identifierare.");
  if (document.transactions.some(t => t.id === args.id)) return document;
  const ore = kronaToOre(args.amount);
  if (!ore) throw new Error("Ange ett giltigt belopp större än noll.");
  const label = args.label.trim() || "Engångsinkomst";
  if (label.length > 90) throw new Error("Beskrivningen får vara högst 90 tecken.");
  try { utcDay(args.bookedOn); }
  catch { throw new Error("Ange ett giltigt datum."); }
  if (args.bookedOn < workspace.anchorOn) {
    throw new Error("Datumet kan inte vara före budgetens start.");
  }

  const transaction: Transaction = {
    id: args.id,
    workspaceId: workspace.id,
    memberId: document.members.find(m => m.workspaceId === workspace.id)?.id ?? null,
    label,
    amountOre: ore,
    bookedOn: args.bookedOn,
    createdAt: args.createdAt,
  };
  return { ...document, transactions: [...document.transactions, transaction] };
}
