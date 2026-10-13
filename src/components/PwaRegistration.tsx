"use client";
import { useEffect } from "react";

/**
 * Keep installed iPhone PWAs in sync with published GitHub Pages builds.
 * The versioned service worker precaches only static shell assets; Firebase
 * data is always read from its server and is never stored by this worker.
 */
export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) return;
    const manifestUrl = new URL(manifest.href);
    const workerUrl = new URL("sw.js", manifestUrl);
    const scopeUrl = new URL("./", manifestUrl);
    let cancelled = false;
    let updating = false;
    // A cold-started iOS PWA can initially report controller === null even
    // though an older worker is installed. Never gate an update on that snapshot.
    // Reload once when a worker takes control, including the first install:
    // that is safer than leaving an installed app running stale client code.
    let reloading = false;
    const onControllerChange = () => {
      if (cancelled || reloading || !navigator.serviceWorker.controller) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | undefined;
    async function checkForUpdates() {
      if (cancelled || updating || !registration || !navigator.onLine) return;
      updating = true;
      try { await registration.update(); }
      catch (error) { console.warn("PWA update check unavailable:", error); }
      finally { updating = false; }
    }
    const onReturn = () => {
      if (!document.hidden) void checkForUpdates();
    };
    const onFocus = () => { void checkForUpdates(); };
    const onPageShow = () => { void checkForUpdates(); };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    navigator.serviceWorker.register(workerUrl.href, {
      scope: scopeUrl.pathname,
      updateViaCache: "none",
    }).then(result => {
      if (cancelled) return;
      registration = result;
      // Always check once at startup, then when opening the installed PWA again.
      void checkForUpdates();
    }).catch(error => console.warn("PWA offline mode unavailable:", error));

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
  return null;
}
