import { type BudgetDocument } from "./budget.ts";

export type StartupAction = "load-cloud" | "create-cloud" | "review-local";
/**
 * Prefer the signed-in account\'s cloud data. Never silently overwrite an
 * unlinked real local budget, or upload it into another account.
 */
export function chooseCloudStartup(
  local: BudgetDocument | null,
  cloud: BudgetDocument | null,
  lastSyncedLocal: string | null,
): StartupAction {
  const actualLocal = local && !local.demo ? local : null;
  if (cloud) {
    if (!actualLocal || JSON.stringify(actualLocal) === JSON.stringify(cloud) ||
        lastSyncedLocal === JSON.stringify(actualLocal)) return "load-cloud";
    return "review-local";
  }
  return actualLocal ? "review-local" : "create-cloud";
}
