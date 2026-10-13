import {
  type BudgetDocument,
  type Recurring,
  type Transaction,
  activeOn, addDays, dailyAccrualOre, dailyNetOre, virtualBalanceOre,
} from "./budget.ts";

/** Calendar-month ledger. Values are integer öre, and balances are virtual, not bank balances. */
export type MonthDay = {
  date: string;
  active: boolean;
  recurringIncomeOre: number;
  recurringExpensesOre: number;
  variableNetOre: number;
  dailyResultOre: number;
  balanceOre: number | null;
  recurring: { item: Recurring; dailyOre: number }[];
  transactions: Transaction[];
};
export type MonthLedger = {
  month: string;
  start: string;
  end: string;
  days: MonthDay[];
  total: {
    recurringIncomeOre: number;
    recurringExpensesOre: number;
    variableNetOre: number;
    dailyResultOre: number;
    balanceOre: number | null;
  };
};
export function shiftMonth(month: string, offset: number): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(offset)) {
    throw new Error("Ogiltig månad");
  }
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}
export function getMonthLedger(doc: BudgetDocument, workspaceId: string, month: string): MonthLedger {
  const next = shiftMonth(month, 1);
  const start = `${month}-01`;
  const end = addDays(`${next}-01`, -1);
  const workspace = doc.workspaces.find(w => w.id === workspaceId);
  const recurring = doc.recurring.filter(r => r.workspaceId === workspaceId);
  const txByDay = new Map<string, Transaction[]>();

  for (const item of doc.transactions) {
    if (item.workspaceId !== workspaceId || item.bookedOn < start || item.bookedOn > end) continue;
    const existing = txByDay.get(item.bookedOn) ?? [];
    existing.push(item);
    txByDay.set(item.bookedOn, existing);
  }

  let runningBalance = workspace?.turnsStart ? 0 : workspace ? virtualBalanceOre(doc, workspaceId, addDays(start, -1)) : 0;
  const days: MonthDay[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const active = !!workspace && day >= workspace.anchorOn;
    const fixed = active ? recurring
      .filter(item => activeOn(item, workspace?.turnsStart ? start : day) && (!workspace?.turnsStart || day.slice(0, 7) !== workspace.turnsStart.day.slice(0, 7)))
      .map(item => ({ item, dailyOre: dailyAccrualOre(item) })) : [];
    const recurringIncomeOre = fixed.reduce((sum, r) => sum + Math.max(0, r.dailyOre), 0);
    const recurringExpensesOre = fixed.reduce((sum, r) => sum + Math.min(0, r.dailyOre), 0);
    const entries = active ? (txByDay.get(day) ?? []) : [];
    const variableNetOre = entries.reduce((sum, t) => sum + t.amountOre, 0);
    const dailyResultOre = (active ? dailyNetOre(doc, workspaceId, day) : 0) + variableNetOre;
    if (active) runningBalance += dailyResultOre;
    days.push({
      date: day, active, recurringIncomeOre, recurringExpensesOre,
      variableNetOre, dailyResultOre, balanceOre: active ? runningBalance : null,
      recurring: fixed, transactions: entries,
    });
  }
  const sum = (key: "recurringIncomeOre" | "recurringExpensesOre" | "variableNetOre" | "dailyResultOre") =>
    days.reduce((total, row) => total + row[key], 0);
  return {
    month, start, end, days,
    total: {
      recurringIncomeOre: sum("recurringIncomeOre"),
      recurringExpensesOre: sum("recurringExpensesOre"),
      variableNetOre: sum("variableNetOre"),
      dailyResultOre: sum("dailyResultOre"),
      balanceOre: days.at(-1)?.balanceOre ?? null,
    },
  };
}
