import { type BudgetDocument, validDocument } from "./budget.ts";

export const localCloudBackupKey = (uid: string) => "budget-app:pre-cloud:" + uid;
type BackupStorage = Pick<Storage, "getItem" | "setItem">;

/** Preserve local budget before fetching cloud state, without automatic file downloads. */
export function preserveLocalCloudBackup(storage: BackupStorage, uid: string, local: BudgetDocument, cloud: BudgetDocument): boolean {
  if (local.demo || JSON.stringify(local) === JSON.stringify(cloud)) return false;
  const key = localCloudBackupKey(uid);
  if (storage.getItem(key) === null) storage.setItem(key, JSON.stringify(local));
  return true;
}
export function readLocalCloudBackup(storage: Pick<Storage, "getItem">, uid: string): BudgetDocument | null {
  const raw = storage.getItem(localCloudBackupKey(uid));
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!validDocument(parsed)) throw new Error("Den lokala säkerhetskopian har ett ogiltigt format.");
  return parsed;
}
