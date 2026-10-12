"use client";
import { useEffect } from "react";

/** Registers the offline shell. Does not cache transaction or account data. */
export function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) return;
    const manifestUrl = new URL(manifest.href);
    const workerUrl = new URL("sw.js", manifestUrl);
    const scopeUrl = new URL("./", manifestUrl);
    navigator.serviceWorker.register(workerUrl.href, { scope: scopeUrl.pathname })
      .catch(error => console.warn("PWA offline mode unavailable:", error));
  }, []);
  return null;
}
