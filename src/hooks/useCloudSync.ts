"use client";
import { useEffect, useRef, useState } from "react";
import { type BudgetDocument, createEmptyBudget, todayLocal, validDocument } from "@/lib/budget";
import { chooseCloudStartup } from "@/lib/cloud-startup";
import { localCloudBackupKey, preserveLocalCloudBackup, readLocalCloudBackup } from "@/lib/cloud-local-backup";
import {
  type CloudServices, type CloudSnapshot, loadCloudServices, watchAuth,
  logIn, register, logOut, readCloud, writeCloud,
} from "@/lib/firebase-cloud";

type Status = "loading" | "disabled" | "signedOut" | "ready" | "active" | "saving" | "blocked" | "error";
const baseKey = (uid: string) => "budget-app:cloud-last-synced:" + uid;
const stringify = (budget: BudgetDocument) => JSON.stringify(budget);

export function useCloudSync(
  budget: BudgetDocument | null,
  replaceBudget: (budget: BudgetDocument) => void,
) {
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState("");
  const [exists, setExists] = useState(false);
  const [message, setMessage] = useState("");
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
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
        setHasLocalBackup(user ? window.localStorage.getItem(localCloudBackupKey(user.uid)) !== null : false);
        if (!user) { setStatus("signedOut"); setExists(false); return; }
        setStatus("loading");
        try {
          const cloud = await readCloud(s, user.uid);
          if (stopped || uid.current !== user.uid) return;
          setExists(!!cloud);
          const local = budgetRef.current;
          const previous = window.localStorage.getItem(baseKey(user.uid));
          const startup = chooseCloudStartup(local, cloud?.budget ?? null, previous);
          if (startup === "load-cloud" && cloud) {
            revision.current = cloud.revision;
            lastSaved.current = stringify(cloud.budget);
            window.localStorage.setItem(baseKey(user.uid),lastSaved.current);
            enabled.current = true;
            replaceBudget(cloud.budget);
            setStatus("active");
            setMessage("Molnsynkronisering aktiv.");
          } else if (startup === "create-cloud") {
            // New account: create a real, empty budget. Demo data is never shown.
            const blank = createEmptyBudget(todayLocal());
            const nextRevision = await writeCloud(s, user.uid, blank, 0);
            if (stopped || uid.current !== user.uid) return;
            revision.current = nextRevision;
            lastSaved.current = stringify(blank);
            window.localStorage.setItem(baseKey(user.uid), lastSaved.current);
            enabled.current = true;
            replaceBudget(blank);
            setExists(true);
            setStatus("active");
            setMessage("Din tomma budget är redo och sparas i molnet.");
          } else {
            // Protect unsynced legacy local data: never silently upload/replace.
            setStatus("ready");
            setMessage(cloud
              ? "Det finns både en molnbudget och en annan lokal budget på den här enheten. Välj Hämta molnbudget för att fortsätta. Den lokala kopian bevaras."
              : "Du har en äldre lokal budget på den här enheten. Välj Lägg min budget i molnet för att koppla den till kontot.");
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
        if (!window.confirm(budget.demo
          ? "Hämta din molnbudget till den här enheten? Den ersätter demobudgeten."
          : "Hämta molnbudgeten? Budgeten som visas här ersätts. En säkerhetskopia av eventuella lokala uppgifter sparas på enheten, utan någon filnedladdning. Vill du ha en separat JSON-fil, avbryt och välj Exportera JSON-backup först.")) {
          setStatus("ready"); return;
        }
        const backedUp = preserveLocalCloudBackup(window.localStorage, account, budget, cloud.budget);
        if (backedUp) setHasLocalBackup(true);
        revision.current = cloud.revision;
        lastSaved.current = stringify(cloud.budget);
        window.localStorage.setItem(baseKey(account),lastSaved.current);
        enabled.current = true;
        replaceBudget(cloud.budget);
        setExists(true); setStatus("active");
        setMessage(backedUp
          ? "Molnbudgeten har hämtats. Den tidigare lokala budgeten finns sparad på enheten och kan återställas under Molnlagring."
          : "Molnbudgeten har hämtats och synkronisering är aktiv.");
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
  function restoreLocalCopy() {
    if (!uid.current || status === "saving") return;
    try {
      const copy = readLocalCloudBackup(window.localStorage, uid.current);
      if (!copy) { setMessage("Ingen tidigare lokal budget finns sparad."); return; }
      if (!window.confirm("Återställa den tidigare lokala budgeten på denna enhet? Molnsynkroniseringen pausas och budgeten i Firebase ändras inte.")) return;
      enabled.current = false;
      blocked.current = false;
      lastSaved.current = "";
      window.localStorage.removeItem(baseKey(uid.current));
      setStatus("ready");
      replaceBudget(copy);
      setMessage("Tidigare lokal budget återställd på denna enhet. Molnbudgeten är oförändrad. Synkroniseringen är pausad.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde inte läsa den lokala säkerhetskopian.");
    }
  }
  return { status, email, exists, message, hasLocalBackup, restoreLocalCopy, active: status === "active" || status === "saving", signIn, signOut, connect, retry };
}
