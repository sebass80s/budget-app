import {
  type BudgetDocument, type Recurring, kronaToOre, utcDay, nextMonth,
} from "./budget.ts";

export type SetupStep = "welcome" | "income" | "costs" | "start" | "ready";
export type SetupKind = "income" | "expense";

/** Existing budgets have no onboarding marker and must never be interrupted. */
export function needsOnboarding(doc: BudgetDocument): boolean {
  return doc.onboarding?.version === 1 && doc.onboarding.completed === false;
}

/** Resume new accounts after a reload if they already saved setup entries. */
export function resumeOnboarding(doc: BudgetDocument): SetupStep {
  if (!needsOnboarding(doc)) return "welcome";
  const entries = doc.recurring.filter(r => r.endsOn === null);
  if (doc.workspaces[0]?.turnsStart) return "ready";
  if (entries.some(r => r.amountOre < 0)) return "start";
  if (entries.some(r => r.amountOre > 0)) return "costs";
  return "welcome";
}

export function finishOnboarding(doc: BudgetDocument): BudgetDocument {
  if (needsOnboarding(doc) && !doc.workspaces[0]?.turnsStart) throw new Error("Ange din startbudget först.");
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
    cadence: "monthly", startsOn: needsOnboarding(doc) ? nextMonth(args.day) : args.day, endsOn: null,
  };
  return { ...doc, recurring: [...doc.recurring, item] };
}

/** Startsaldo is captured once for a new account and only impacts its first month. */
export function setInitialTurnsBalance(doc: BudgetDocument, day: string, raw: string): BudgetDocument {
  if (!needsOnboarding(doc)) throw new Error("Startbudget kan endast anges när kontot skapas.");
  const cleaned = raw.trim().replace(/\\s/g, "").replace(",", ".");
  if (!/^(?:0|[0-9]+)(?:\\.[0-9]{1,2})?$/.test(cleaned)) throw new Error("Ange ett giltigt belopp i kronor.");
  const availableOre = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(availableOre)) throw new Error("Beloppet är för stort.");
  utcDay(day);
  return { ...doc, workspaces: doc.workspaces.map((w,i) =>
    i === 0 ? { ...w, anchorOn: day, turnsStart: { day, availableOre } } : w,
  ) };
}

/** Existing account: explicit opt-in, with all earlier dates still using the old ledger. */
export function startMonthlyTurnsForExisting(doc: BudgetDocument, day: string, raw: string): BudgetDocument {
  if (needsOnboarding(doc)) throw new Error("Slutför introduktionen först.");
  const ws=doc.workspaces[0];
  if (!ws || ws.turnsStart) throw new Error("Startbudgeten kan endast anges en gång.");
  const cleaned=raw.trim().replace(/\\s/g,"").replace(",",".");
  if (!/^(?:0|[0-9]+)(?:\\.[0-9]{1,2})?$/.test(cleaned)) throw new Error("Ange ett giltigt belopp.");
  const amount=Math.round(Number(cleaned)*100);
  if (!Number.isSafeInteger(amount)) throw new Error("Beloppet är för stort.");
  utcDay(day);
  if (day < ws.anchorOn) throw new Error("Startdatumet kan inte vara före kontots start.");
  return {...doc,workspaces:doc.workspaces.map((w,i)=>i===0?{...w,turnsStart:{day,availableOre:amount}}:w)};
}
