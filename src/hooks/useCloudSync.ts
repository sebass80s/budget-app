"use client";
import { useEffect, useRef, useState } from "react";
import { type BudgetDocument, createEmptyBudget, todayLocal } from "@/lib/budget";
import {
  type CloudServices, type CloudSnapshot, loadCloudServices, watchAuth,
  logIn, register, logOut, readCloud, changeCloud, createCloudBudget, watchCloud,
} from "@/lib/firebase-cloud";

type Status = "loading" | "disabled" | "signedOut" | "active" | "saving" | "offline" | "error";
type Change = (current: BudgetDocument) => BudgetDocument;

export function useCloudSync() {
  const [budget, setBudget] = useState<BudgetDocument | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const services = useRef<CloudServices | null>(null);
  const account = useRef<string | null>(null);
  const revision = useRef(0);
  const saving = useRef(false);
  const statusRef = useRef<Status>("loading");
  const budgetRef = useRef<BudgetDocument | null>(null);

  function changeStatus(next: Status) {
    statusRef.current = next;
    setStatus(next);
  }
  function applySnapshot(snapshot: CloudSnapshot) {
    if (snapshot.revision < revision.current) return;
    revision.current = snapshot.revision;
    budgetRef.current = snapshot.budget;
    setBudget(snapshot.budget);
  }

  useEffect(() => {
    let stopped = false;
    let unsubscribeAuth = () => {};
    let unsubscribeCloud = () => {};
    const offline = () => {
      if (account.current) {
        changeStatus("offline");
        setMessage("Ingen internetanslutning. Budgeten kan inte ändras förrän Firebase är tillgängligt igen.");
      }
    };
    const online = () => {
      if (account.current) window.location.reload();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);

    loadCloudServices().then(service => {
      if (stopped) return;
      if (!service) { changeStatus("disabled"); return; }
      services.current = service;
      unsubscribeAuth = watchAuth(service, async user => {
        if (stopped) return;
        unsubscribeCloud();
        account.current = user?.uid ?? null;
        budgetRef.current = null;
        setBudget(null);
        revision.current = 0;
        setEmail(user?.email ?? "");
        setMessage("");
        if (!user) { changeStatus("signedOut"); return; }
        changeStatus("loading");
        try {
          // A server read is mandatory. Never display budget data from localStorage
          // or Firebase's offline cache as if it were saved in the cloud.
          const found = await readCloud(service, user.uid);
          const snapshot = found ?? await createCloudBudget(service, user.uid, {
            ...createEmptyBudget(todayLocal()),
            onboarding: { version: 1, completed: false },
          });
          if (stopped || account.current !== user.uid) return;
          applySnapshot(snapshot);
          changeStatus("active");
          unsubscribeCloud = watchCloud(service, user.uid, incoming => {
            if (stopped || account.current !== user.uid) return;
            if (incoming.revision > revision.current) {
              applySnapshot(incoming);
              if (!saving.current) {
                changeStatus("active");
                setMessage("Uppdaterad från Firebase.");
              }
            }
          }, error => {
            if (stopped || account.current !== user.uid) return;
            changeStatus("error");
            setMessage("Anslutningen till Firebase avbröts: " + error.message);
          });
        } catch (error) {
          if (stopped || account.current !== user.uid) return;
          changeStatus(navigator.onLine ? "error" : "offline");
          setMessage(error instanceof Error ? error.message : "Budgeten kunde inte hämtas från Firebase.");
        }
      });
    }).catch(error => {
      if (stopped) return;
      changeStatus(navigator.onLine ? "error" : "offline");
      setMessage(error instanceof Error ? error.message : "Firebase kunde inte startas.");
    });
    return () => {
      stopped = true;
      unsubscribeAuth();
      unsubscribeCloud();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  async function saveBudget(change: Change): Promise<boolean> {
    const uid = account.current;
    const service = services.current;
    if (!uid || !service || statusRef.current !== "active" || saving.current || !navigator.onLine) {
      setMessage("Ändringen sparades inte. Kontrollera anslutningen till Firebase och försök igen.");
      return false;
    }
    saving.current = true;
    changeStatus("saving");
    setMessage("Sparar i Firebase …");
    try {
      // Firestore transaction runs the change against the newest server
      // document. UI data updates only after the server confirms the commit.
      const confirmed = await changeCloud(service, uid, change);
      if (account.current !== uid) return false;
      applySnapshot(confirmed);
      changeStatus("active");
      setMessage("Sparat i Firebase.");
      return true;
    } catch (error) {
      if (account.current !== uid) return false;
      const detail = error instanceof Error ? error.message : "Okänt fel.";
      changeStatus(navigator.onLine ? "active" : "offline");
      setMessage("Ändringen sparades INTE i Firebase: " + detail);
      return false;
    } finally {
      saving.current = false;
    }
  }

  async function signIn(address: string, password: string, create: boolean) {
    if (!services.current) return;
    setMessage("");
    try {
      if (create) await register(services.current, address, password);
      else await logIn(services.current, address, password);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setMessage(/api-key|invalid-api-key/i.test(detail)
        ? "Firebase-nyckeln godkänns inte. Kontakta appens administratör."
        : detail || "Inloggningen misslyckades.");
    }
  }

  async function signOut() {
    const service = services.current;
    if (!service || saving.current) return;
    changeStatus("loading");
    budgetRef.current = null;
    setBudget(null);
    try { await logOut(service); }
    catch (error) {
      changeStatus("error");
      setMessage(error instanceof Error ? error.message : "Utloggning misslyckades.");
    }
  }

  return {
    budget, status, email, message, active: status === "active" || status === "saving",
    signIn, signOut, saveBudget,
  };
}
