"use client";
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { doc, getDocFromServer, getFirestore, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import { type BudgetDocument, validDocument } from "@/lib/budget";

export type CloudServices = { app: FirebaseApp; auth: Auth; db: Firestore };
export type CloudSnapshot = { revision: number; budget: BudgetDocument };

type WebConfig = FirebaseOptions & { enabled: true };
const publicConfigKey = "budget-app:firebase-public-config";
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
  let config: WebConfig | null;
  try {
    const response = await fetch(url.href, { cache: "no-store" });
    if (!response.ok) throw new Error("Firebase-konfigurationen gick inte att hämta.");
    config = parseWebConfig(await response.json());
    if (!config) return null;
    // The public web config may be cached locally for authenticated offline PWA use.
    window.localStorage.setItem(publicConfigKey, JSON.stringify(config));
  } catch (error) {
    if (navigator.onLine) throw error;
    const cached = window.localStorage.getItem(publicConfigKey);
    if (!cached) throw error;
    config = parseWebConfig(JSON.parse(cached));
    if (!config) throw error;
  }
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
export async function readCloud(s: CloudServices, uid: string): Promise<CloudSnapshot | null> {
  const snap = await getDocFromServer(ref(s,uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!Number.isSafeInteger(data.revision) || data.revision < 1 || typeof data.payload !== "string") {
    throw new Error("Molnkopian har ett okänt format.");
  }
  const parsed: unknown = JSON.parse(data.payload);
  if (!validDocument(parsed)) throw new Error("Molnkopian har ett ogiltigt budgetformat.");
  return { revision:data.revision, budget:parsed };
}
export async function writeCloud(s: CloudServices,uid:string,budget:BudgetDocument,expected:number):Promise<number> {
  if (!validDocument(budget) || budget.demo) throw new Error("Demodata kan inte synkroniseras.");
  const payload = JSON.stringify(budget);
  if (payload.length > 790000) throw new Error("Budgeten är för stor för molnlagringen i denna version.");
  return runTransaction(s.db, async tx => {
    const document = ref(s,uid);
    const previous = await tx.get(document);
    if (previous.exists()) {
      if (previous.data().revision !== expected) {
        throw new Error("Molnbudgeten ändrades på en annan enhet. Exportera lokal backup och hämta från molnet.");
      }
    } else if (expected !== 0) {
      throw new Error("Molnkopian saknas. Ingen data skrevs över.");
    }
    const revision = expected + 1;
    tx.set(document, {payload,revision,updatedAt:serverTimestamp()});
    return revision;
  });
}
