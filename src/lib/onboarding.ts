import {
  type BudgetDocument, type Recurring, kronaToOre, utcDay,
} from "./budget.ts";

export type SetupStep = "welcome" | "income" | "costs" | "ready";
export type SetupKind = "income" | "expense";

/** Existing budgets have no onboarding marker and must never be interrupted. */
export function needsOnboarding(doc: BudgetDocument): boolean {
  return doc.onboarding?.version === 1 && doc.onboarding.completed === false;
}

/** Resume new accounts after a reload if they already saved setup entries. */
export function resumeOnboarding(doc: BudgetDocument): SetupStep {
  if (!needsOnboarding(doc)) return "welcome";
  const entries = doc.recurring.filter(r => r.endsOn === null);
  if (entries.some(r => r.amountOre < 0)) return "ready";
  if (entries.some(r => r.amountOre > 0)) return "costs";
  return "welcome";
}

export function finishOnboarding(doc: BudgetDocument): BudgetDocument {
  return { ...doc, onboarding: { version: 1, completed: true } };
}

/** One transaction per entry, applied to the latest Firebase server document. */
export function addSetupEntry(
  doc: BudgetDocument,
  args: { kind: SetupKind; label: string; amount: string; day: string; id: string },
): BudgetDocument {
  const ore = kronaToOre(args.amount);
  const label = args.label.trim();
  if (!ore) throw new Error("Ange ett giltigt belopp större än noll.");
  if (!label || label.length > 90) throw new Error("Beskrivningen ska vara 1–90 tecken.");
  utcDay(args.day);
  if (!args.id) throw new Error("Posten saknar identifierare.");
  const ws = doc.workspaces[0];
  if (!ws) throw new Error("Ingen budget är kopplad till kontot.");
  if (doc.recurring.some(r => r.id === args.id)) return doc;
  const item: Recurring = {
    id: args.id, workspaceId: ws.id, memberId: doc.members[0]?.id ?? null,
    label, amountOre: args.kind === "income" ? ore : -ore,
    cadence: "monthly", startsOn: args.day, endsOn: null,
  };
  return { ...doc, recurring: [...doc.recurring, item] };
}
