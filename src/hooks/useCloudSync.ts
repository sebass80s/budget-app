"use client";
import { useEffect, useRef, useState } from "react";
import { type BudgetDocument, validDocument } from "@/lib/budget";
import {
  type CloudServices, type CloudSnapshot, loadCloudServices, watchAuth,
  logIn, register, logOut, readCloud, writeCloud,
} from "@/lib/firebase-cloud";

type Status = "loading" | "disabled" | "signedOut" | "ready" | "active" | "saving" | "blocked" | "error";
const baseKey = (uid: string) => "budget-app:cloud-last-synced:" + uid;
const stringify = (budget: BudgetDocument) => JSON.stringify(budget);

function backupLocally(budget: BudgetDocument, uid: string) {
  const saved = stringify(budget);
  window.localStorage.setItem("budget-app:pre-cloud:" + uid, saved);
  const url = URL.createObjectURL(new Blob([JSON.stringify(budget, null, 2)], { type:"application/json" }));
  const link = window.document.createElement("a");
  link.href = url; link.download = "budget-app-before-cloud.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function useCloudSync(
  budget: BudgetDocument | null,
  replaceBudget: (budget: BudgetDocument) => void,
) {
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState("");
  const [exists, setExists] = useState(false);
  const [message, setMessage] = useState("");
  const services = useRef<CloudServices | null>(null);
  const uid = useRef<string | null>(null);
  const budgetRef = useRef(budget);
  const enabled = useRef(false);
  const blocked = useRef(false);
  const revision = useRef(0);
  const lastSaved = useRef("");
  const writes = useRef<Promise<void>>(Promise.resolve());
  budgetRef.current = budget;

  useEffect(() => {
    let stopped = false;
    let unsubscribe = () => {};
    loadCloudServices().then(s => {
      if (stopped) return;
      if (!s) { setStatus("disabled"); return; }
      services.current = s;
      unsubscribe = watchAuth(s, async user => {
        if (stopped) return;
        enabled.current = false; blocked.current = false;
        uid.current = user?.uid ?? null;
        setEmail(user?.email ?? "");
        if (!user) { setStatus("signedOut"); setExists(false); return; }
        setStatus("loading");
        try {
          const cloud = await readCloud(s, user.uid);
          if (stopped || uid.current !== user.uid) return;
          setExists(!!cloud);
          const local = budgetRef.current;
          const previous = window.localStorage.getItem(baseKey(user.uid));
          // Auto-reconnect only if local data is exactly the last successful cloud save.
          if (cloud && local && previous === stringify(local)) {
            revision.current = cloud.revision;
            lastSaved.current = stringify(cloud.budget);
            window.localStorage.setItem(baseKey(user.uid),lastSaved.current);
            enabled.current = true;
            replaceBudget(cloud.budget);
            setStatus("active");
          } else {
            setStatus("ready");
            setMessage(cloud
              ? "Molnkopian finns. Hämta den när du vill ansluta."
              : "Ditt konto är redo. Du kan lägga din lokala budget i molnet.");
          }
        } catch (error) {
          if (!stopped) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Molnet kunde inte läsas."); }
        }
      });
    }).catch(error => {
      if (!stopped) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Firebase kunde inte startas."); }
    });
    return () => { stopped = true; unsubscribe(); enabled.current = false; };
  // Intentionally mount only once to preserve a stable cloud session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!budget || !enabled.current || blocked.current || !services.current || !uid.current) return;
    const serialized = stringify(budget);
    if (serialized === lastSaved.current) return;
    const service = services.current;
    const account = uid.current;
    writes.current = writes.current.then(async () => {
      if (blocked.current || !enabled.current || uid.current !== account || serialized === lastSaved.current) return;
      setStatus("saving");
      try {
        const nextRevision = await writeCloud(service, account, JSON.parse(serialized) as BudgetDocument, revision.current);
        revision.current = nextRevision;
        lastSaved.current = serialized;
        window.localStorage.setItem(baseKey(account), serialized);
        setStatus("active");
        setMessage("Molnbudgeten är sparad.");
      } catch (error) {
        blocked.current = true;
        setStatus("blocked");
        setMessage(error instanceof Error ? error.message : "Molnlagringen misslyckades. Exportera en backup.");
      }
    });
  }, [budget]);

  async function signIn(address: string, password: string, create: boolean) {
    if (!services.current) return;
    setMessage("");
    try {
      if (create) await register(services.current,address,password);
      else await logIn(services.current,address,password);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setMessage(/api-key|invalid-api-key/i.test(detail)
        ? "Firebase-nyckeln godkänns inte. Kontrollera FIREBASE_CONFIG_JSON på GitHub och publicera webbappen igen."
        : detail || "Inloggningen misslyckades.");
    }
  }
  async function signOut() {
    if (!services.current) return;
    enabled.current = false;
    await logOut(services.current);
    setMessage("Du är utloggad. Den lokala budgetkopian finns fortfarande på enheten.");
  }
  async function connect() {
    if (!services.current || !uid.current || !budget) return;
    const service = services.current;
    const account = uid.current;
    enabled.current = false;
    blocked.current = false;
    setStatus("loading");
    try {
      const cloud: CloudSnapshot | null = await readCloud(service, account);
      if (uid.current !== account) return;
      if (cloud) {
        if (!window.confirm("Hämta budgeten från molnet? Den ersätter den budget som visas här. En JSON-backup av den lokala kopian laddas ned först.")) {
          setStatus("ready"); return;
        }
        backupLocally(budget, account);
        revision.current = cloud.revision;
        lastSaved.current = stringify(cloud.budget);
        window.localStorage.setItem(baseKey(account),lastSaved.current);
        enabled.current = true;
        replaceBudget(cloud.budget);
        setExists(true); setStatus("active");
        setMessage("Molnbudgeten har hämtats och synkronisering är aktiv.");
      } else {
        if (!validDocument(budget) || budget.demo) {
          setStatus("ready");
          setMessage("Avsluta demoversionen innan du laddar upp budgeten.");
          return;
        }
        const next = await writeCloud(service, account, budget, 0);
        revision.current = next;
        lastSaved.current = stringify(budget);
        window.localStorage.setItem(baseKey(account),lastSaved.current);
        enabled.current = true;
        setExists(true); setStatus("active");
        setMessage("Budgeten har sparats i molnet och synkronisering är aktiv.");
      }
    } catch (error) {
      blocked.current = true;
      setStatus("blocked");
      setMessage(error instanceof Error ? error.message : "Synkronisering misslyckades.");
    }
  }
  async function retry() {
    if (!services.current || !uid.current) return;
    const account = uid.current;
    try {
      const cloud = await readCloud(services.current,account);
      if (!cloud || cloud.revision !== revision.current) {
        setStatus("blocked");
        setMessage("Molnet har ändrats. Exportera en backup och välj Hämta molnbudget.");
        return;
      }
      blocked.current = false;
      enabled.current = true;
      setStatus("active");
      const current = budgetRef.current;
      if (current && stringify(current) !== lastSaved.current) {
        const serial = stringify(current);
        setStatus("saving");
        const next = await writeCloud(services.current,account,current,revision.current);
        revision.current = next;
        lastSaved.current = serial;
        window.localStorage.setItem(baseKey(account),serial);
      }
      setStatus("active");
      setMessage("Synkronisering återupptagen.");
    } catch (error) {
      blocked.current = true;
      setStatus("blocked");
      setMessage(error instanceof Error ? error.message : "Kunde inte ansluta till molnet.");
    }
  }
  return { status, email, exists, message, active: status === "active" || status === "saving", signIn, signOut, connect, retry };
}
