/**
 * Civ-inspired budget model. All money is integer öre (SEK / 100).
 * The accrual balance is NOT a bank balance.
 */
export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly";
export type Member = { id: string; workspaceId: string; displayName: string; role: "owner" | "member" };
export type Workspace = {
  id: string;
  name: string;
  currency: "SEK";
  createdOn: string;
  anchorOn: string;
  openingBalanceOre: number;
  /** Opt-in monthly TURNS model. Missing on legacy accounts to preserve past calculations. */
  turnsStart?: { day: string; availableOre: number };
};
export type Recurring = {
  id: string;
  workspaceId: string;
  memberId: string | null;
  label: string;
  amountOre: number;
  cadence: Cadence;
  startsOn: string;
  endsOn: string | null;
};
export type Transaction = {
  id: string;
  workspaceId: string;
  memberId: string | null;
  label: string;
  amountOre: number;
  bookedOn: string;
  createdAt: string;
};
export type BudgetDocument = {
  schemaVersion: 1;
  demo: boolean;
  workspaces: Workspace[];
  members: Member[];
  recurring: Recurring[];
  transactions: Transaction[];
  /** Only budgets created after onboarding was introduced contain this field.
   * Missing field means an existing account and must not start onboarding. */
  onboarding?: { version: 1; completed: boolean };
};

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2425;
export const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function utcDay(day: string): number {
  if (!ISO_DAY_RE.test(day)) throw new Error("Ogiltigt datum");
  const ms = Date.parse(day + "T00:00:00.000Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== day) {
    throw new Error("Ogiltigt datum");
  }
  return ms;
}
export function addDays(day: string, days: number): string {
  return new Date(utcDay(day) + days * DAY_MS).toISOString().slice(0, 10);
}
export function daysBetween(start: string, end: string): number {
  return Math.round((utcDay(end) - utcDay(start)) / DAY_MS);
}
export function todayLocal(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
export function validOre(value: number): boolean {
  return Number.isSafeInteger(value);
}
export function kronaToOre(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
export function activeOn(item: Recurring, day: string): boolean {
  return item.startsOn <= day && (item.endsOn === null || item.endsOn >= day);
}
const yearlyMultiplier: Record<Cadence, number> = {
  weekly: YEAR_DAYS / 7,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};
export function dailyAccrualOre(item: Recurring): number {
  return Math.round((item.amountOre * yearlyMultiplier[item.cadence]) / YEAR_DAYS);
}
export function monthStart(day: string): string { return day.slice(0, 7) + "-01"; }
export function nextMonth(day: string): string {
  const first = monthStart(day);
  return new Date(Date.UTC(Number(first.slice(0,4)), Number(first.slice(5,7)), 1)).toISOString().slice(0,10);
}
export function monthEnd(day: string): string { return addDays(nextMonth(day), -1); }
export function monthlyTurnsNetOre(doc: BudgetDocument, workspaceId: string, day: string): number {
  const start = monthStart(day), end = monthEnd(day);
  const recurringOre = doc.recurring
    .filter(r => r.workspaceId === workspaceId && activeOn(r, start))
    .reduce((sum, r) => sum + Math.round(r.amountOre * (
      r.cadence === "monthly" ? 1 : r.cadence === "weekly" ? 52 / 12 :
      r.cadence === "quarterly" ? 1 / 3 : 1 / 12
    )), 0);
  const days = daysBetween(start, end) + 1;
  // Integer öre across TURNS: the last days receive the remainder.
  const index = daysBetween(start, day);
  const before = Math.floor(recurringOre * index / days);
  const after = Math.floor(recurringOre * (index + 1) / days);
  return after - before;
}
export function dailyNetOre(doc: BudgetDocument, workspaceId: string, day: string): number {
  const start = doc.workspaces.find(w => w.id === workspaceId)?.turnsStart;
  if (start) {
    if (day < start.day) return 0;
    if (day.slice(0,7) === start.day.slice(0,7)) {
      const remaining = daysBetween(start.day, monthEnd(day)) + 1;
      const index = daysBetween(start.day, day);
      return Math.floor(start.availableOre * (index + 1) / remaining)
        - Math.floor(start.availableOre * index / remaining);
    }
    return monthlyTurnsNetOre(doc, workspaceId, day);
  }
  return doc.recurring
    .filter((r) => r.workspaceId === workspaceId && activeOn(r, day))
    .reduce((sum, r) => sum + dailyAccrualOre(r), 0);
}
export function dailyResultOre(doc: BudgetDocument, workspaceId: string, day: string): number {
  const entries = doc.transactions
    .filter((t) => t.workspaceId === workspaceId && t.bookedOn === day)
    .reduce((sum, t) => sum + t.amountOre, 0);
  return dailyNetOre(doc, workspaceId, day) + entries;
}
export function rangeResultOre(doc: BudgetDocument, workspaceId: string, start: string, end: string): number {
  const workspace = doc.workspaces.find((w) => w.id === workspaceId);
  if (!workspace || start > end) return 0;
  const effectiveStart = start > workspace.anchorOn ? start : workspace.anchorOn;
  if (effectiveStart > end) return 0;
  let sum = 0;
  for (let d = effectiveStart; d <= end; d = addDays(d, 1)) {
    sum += dailyResultOre(doc, workspaceId, d);
  }
  return sum;
}
export function virtualBalanceOre(doc: BudgetDocument, workspaceId: string, day: string): number {
  const w = doc.workspaces.find((item) => item.id === workspaceId);
  if (!w) return 0;
  if (w.turnsStart) {
    if (day < w.turnsStart.day) return 0;
    // Reset the monthly result. Previous months never increase next month's TURNS.
    const first = monthStart(day);
    return (first === monthStart(w.turnsStart.day) ? 0 : 0) +
      rangeResultOre(doc, workspaceId, first, day);
  }
  return w.openingBalanceOre + rangeResultOre(doc, workspaceId, w.anchorOn, day);
}
export function mondayOnOrBefore(day: string): string {
  const weekday = new Date(utcDay(day)).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}
export function createEmptyBudget(today: string): BudgetDocument {
  utcDay(today);
  return {
    schemaVersion: 1,
    demo: false,
    workspaces: [{ id: "personal", name: "Min ekonomi", currency: "SEK", createdOn: today, anchorOn: today, openingBalanceOre: 0 }],
    members: [{ id: "owner", workspaceId: "personal", displayName: "Jag", role: "owner" }],
    recurring: [],
    transactions: [],
  };
}
export function createDemoBudget(today: string): BudgetDocument {
  const doc = createEmptyBudget(today);
  doc.demo = true;
  doc.workspaces[0].anchorOn = addDays(today, -29);
  const since = doc.workspaces[0].anchorOn;
  const item = (id: string, label: string, amountOre: number, cadence: Cadence): Recurring =>
    ({ id, label, amountOre, cadence, startsOn: since, endsOn: null, workspaceId: "personal", memberId: "owner" });
  doc.recurring = [
    item("salary", "Lön", 3500000, "monthly"),
    item("rent", "Boende", -1120000, "monthly"),
    item("electric", "El", -68000, "monthly"),
    item("insurance", "Försäkringar", -49000, "monthly"),
    item("phone", "Mobil & streaming", -29900, "monthly"),
  ];
  doc.transactions = [
    { id: "demo-groceries", label: "Matbutik", amountOre: -78900, bookedOn: addDays(today, -8), createdAt: new Date().toISOString(), workspaceId: "personal", memberId: "owner" },
    { id: "demo-fuel", label: "Bensin", amountOre: -63000, bookedOn: addDays(today, -3), createdAt: new Date().toISOString(), workspaceId: "personal", memberId: "owner" },
    { id: "demo-coffee", label: "Fika", amountOre: -8900, bookedOn: today, createdAt: new Date().toISOString(), workspaceId: "personal", memberId: "owner" },
  ];
  return doc;
}
export function validDocument(value: unknown): value is BudgetDocument {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<BudgetDocument>;
  const onboarding = d.onboarding;
  if (onboarding !== undefined &&
      (!onboarding || onboarding.version !== 1 || typeof onboarding.completed !== "boolean")) return false;
  if (d.schemaVersion !== 1 || !Array.isArray(d.workspaces) || !Array.isArray(d.members) ||
    !Array.isArray(d.recurring) || !Array.isArray(d.transactions) || typeof d.demo !== "boolean") return false;
  try {
    return d.workspaces.length > 0 &&
      d.workspaces.every((w) => !!w.id && !!w.name && w.currency === "SEK" && validOre(w.openingBalanceOre) && !!utcDay(w.anchorOn) && (w.turnsStart === undefined || (validOre(w.turnsStart.availableOre) && w.turnsStart.availableOre >= 0 && !!utcDay(w.turnsStart.day) && w.turnsStart.day === w.anchorOn))) &&
      d.members.every((m) => !!m.id && !!m.workspaceId && !!m.displayName) &&
      d.recurring.every((r) => !!r.id && !!r.workspaceId && !!r.label && validOre(r.amountOre) &&
        !!yearlyMultiplier[r.cadence] && !!utcDay(r.startsOn) && (r.endsOn === null || !!utcDay(r.endsOn))) &&
      d.transactions.every((t) => !!t.id && !!t.workspaceId && !!t.label && validOre(t.amountOre) && !!utcDay(t.bookedOn));
  } catch {
    return false;
  }
}
export function replaceRecurringFrom(doc: BudgetDocument, id: string, startDay: string, amountOre: number): BudgetDocument {
  const old = doc.recurring.find((r) => r.id === id);
  if (!old || !validOre(amountOre) || startDay < old.startsOn) return doc;
  const replacement = { ...old, id: crypto.randomUUID(), amountOre, startsOn: startDay, endsOn: null };
  const recurring = old.startsOn === startDay
    ? doc.recurring.filter((r) => r.id !== id)
    : doc.recurring.map((r) => r.id === id ? { ...r, endsOn: addDays(startDay, -1) } : r);
  return { ...doc, recurring: [...recurring, replacement] };
}
