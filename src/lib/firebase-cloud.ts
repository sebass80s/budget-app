"use client";
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { doc, getDocFromServer, getFirestore, onSnapshot, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import { type BudgetDocument, validDocument } from "@/lib/budget";
import { prepareCloudChange } from "@/lib/cloud-updates";

export type CloudServices = { app: FirebaseApp; auth: Auth; db: Firestore };
export type CloudSnapshot = { revision: number; budget: BudgetDocument };

type WebConfig = FirebaseOptions & { enabled: true };
function parseWebConfig(value: unknown): WebConfig | null {
  if (!value || typeof value !== "object") throw new Error("Ogiltig Firebase-konfiguration.");
  const config = value as Record<string, unknown>;
  if (config.enabled !== true) return null;
  for (const field of ["apiKey", "authDomain", "projectId", "appId"]) {
    if (typeof config[field] !== "string" || !config[field]) throw new Error("Ogiltig Firebase-konfiguration.");
  }
  return config as unknown as WebConfig;
}

export async function loadCloudServices(): Promise<CloudServices | null> {
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifest) throw new Error("Appmanifest saknas.");
  const url = new URL("firebase-config.json", manifest.href);
  const response = await fetch(url.href, { cache: "no-store" });
  if (!response.ok) throw new Error("Firebase-konfigurationen gick inte att hämta.");
  const config = parseWebConfig(await response.json());
  if (!config) return null;
  const name = "budget-app-cloud";
  const app = getApps().find(item => item.name === name) ?? initializeApp(config, name);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}
function ref(s: CloudServices, uid: string) { return doc(s.db,"users",uid,"budgets","main"); }
export function watchAuth(s: CloudServices, callback: (u: User | null) => void) {
  return onAuthStateChanged(s.auth,callback);
}
export async function logIn(s: CloudServices, email: string, password: string) {
  await signInWithEmailAndPassword(s.auth,email,password);
}
export async function register(s: CloudServices, email: string, password: string) {
  await createUserWithEmailAndPassword(s.auth,email,password);
}
export async function logOut(s: CloudServices) { await signOut(s.auth); }
function snapshotToBudget(data: Record<string, unknown>): CloudSnapshot {
  if (!Number.isSafeInteger(data.revision) || (data.revision as number) < 1 ||
      typeof data.payload !== "string") {
    throw new Error("Molnkopian har ett okänt format.");
  }
  const parsed: unknown = JSON.parse(data.payload);
  if (!validDocument(parsed) || parsed.demo) throw new Error("Molnkopian har ett ogiltigt budgetformat.");
  return { revision: data.revision as number, budget: parsed };
}

export async function readCloud(s: CloudServices, uid: string): Promise<CloudSnapshot | null> {
  const snap = await getDocFromServer(ref(s, uid));
  return snap.exists() ? snapshotToBudget(snap.data()) : null;
}

/** Firestore is the only budget source. Ignore SDK cache and uncommitted local snapshots. */
export function watchCloud(
  s: CloudServices,
  uid: string,
  update: (value: CloudSnapshot) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(ref(s, uid), { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.exists() || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    try { update(snapshotToBudget(snapshot.data())); }
    catch (error) { onError(error instanceof Error ? error : new Error("Kunde inte läsa molnbudgeten.")); }
  }, onError);
}

/** A Firebase transaction applies edits to the latest server version, even across devices. */
export async function changeCloud(
  s: CloudServices,
  uid: string,
  change: (budget: BudgetDocument) => BudgetDocument,
): Promise<CloudSnapshot> {
  return runTransaction(s.db, async tx => {
    const key = ref(s, uid);
    const snap = await tx.get(key);
    if (!snap.exists()) throw new Error("Molnbudgeten saknas. Ladda om sidan.");
    const previous = snapshotToBudget(snap.data());
    const next = prepareCloudChange(previous.budget, change);
    const revision = previous.revision + 1;
    tx.set(key, {
      payload: JSON.stringify(next),
      revision,
      updatedAt: serverTimestamp(),
    });
    return { revision, budget: next };
  });
}

export async function createCloudBudget(s: CloudServices, uid: string, budget: BudgetDocument): Promise<CloudSnapshot> {
  if (!validDocument(budget) || budget.demo) throw new Error("Ogiltig ny budget.");
  return runTransaction(s.db, async tx => {
    const key = ref(s, uid);
    const snap = await tx.get(key);
    if (snap.exists()) return snapshotToBudget(snap.data());
    tx.set(key, { payload: JSON.stringify(budget), revision: 1, updatedAt: serverTimestamp() });
    return { revision: 1, budget };
  });
}
