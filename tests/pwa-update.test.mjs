import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registration = readFileSync(new URL("../src/components/PwaRegistration.tsx", import.meta.url), "utf8");
const generator = readFileSync(new URL("../scripts/generate-sw.mjs", import.meta.url), "utf8");

test("iOS PWA refreshes on worker takeover even if controller was initially null", () => {
  // A snapshot of the controller during initial render can be null in iOS.
  assert.doesNotMatch(registration, /const hadController\s*=/);
  assert.match(registration, /const onControllerChange\s*=\s*\(\)\s*=>\s*\{/);
  assert.match(registration, /reloading\s*=\s*true;\s*window\.location\.reload\(\)/);
  assert.match(registration, /serviceWorker\.addEventListener\("controllerchange", onControllerChange\)/);
});

test("iOS PWA also checks for updates on page restoration", () => {
  assert.match(registration, /addEventListener\("pageshow", onPageShow\)/);
  assert.match(registration, /removeEventListener\("pageshow", onPageShow\)/);
});

test("PWA navigations always bypass stale HTTP HTML while retaining offline fallback", () => {
  assert.ok(generator.includes('fetch(request, {cache: "no-store"}).catch('));
  assert.ok(generator.includes('caches.match(ROOT + "index.html")'));
});
