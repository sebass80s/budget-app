import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
const out = path.resolve("out");
const manifest = JSON.parse(await readFile(path.join(out, "manifest.webmanifest"), "utf8"));
const base = process.env.GITHUB_PAGES === "true" ? "/budget-app/" : "/";
const manifestUrl = "https://example.org" + base + "manifest.webmanifest";
assert.equal(manifest.display, "standalone");
assert.equal(new URL(manifest.start_url, manifestUrl).pathname, base);
assert.equal(new URL(manifest.scope, manifestUrl).pathname, base);
for (const size of [192, 512]) {
  const entry = manifest.icons.find(icon => icon.sizes === size + "x" + size && icon.purpose === "any");
  assert.ok(entry, "Missing " + size + "px app icon");
  const png = await readFile(path.join(out, "icons", "icon-" + size + ".png"));
  assert.equal(png.subarray(0,8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
assert.ok(manifest.icons.some(icon => icon.purpose === "maskable"));
const html = await readFile(path.join(out, "index.html"), "utf8");
assert.ok(html.includes(base + "manifest.webmanifest"), "Manifest reference must contain base path");
assert.ok(html.includes(base + "icons/apple-touch-icon-180.png"), "iOS icon missing");
const sw = await readFile(path.join(out, "sw.js"), "utf8");
assert.ok(sw.includes(base + "index.html"), "SW missing offline app shell");
assert.ok(sw.includes(base + "_next/static/"), "SW missing Next.js assets");
assert.ok(sw.includes('self.addEventListener("fetch"'), "SW missing offline handler");
const assetList = sw.match(/^const ASSETS = (\\[[^\\n]+\\]);/m);
assert.ok(assetList, "SW missing list of cached assets");
const precached = JSON.parse(assetList[1]);
assert.ok(!precached.includes(base + "firebase-config.json"), "Cloud config must never be pre-cached");
assert.ok(sw.includes('fetch(request, {cache: "no-store"})'), "Cloud config must always be loaded from network");
const listeners = new Map();
const env = {
  self: {
    location: { origin: "https://example.org" },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener: (name, fn) => listeners.set(name, fn),
  },
  caches: { match: async key => String(key).endsWith("/index.html") ? { offlineShell: true } : undefined },
  fetch: async () => { throw new Error("offline"); },
  URL, Response, Promise,
};
vm.runInNewContext(sw, env);
let response;
listeners.get("fetch")({
  request: { method: "GET", mode: "navigate", url: "https://example.org" + base },
  respondWith: value => { response = value; },
});
assert.equal((await response).offlineShell, true, "SW offline navigation fallback failed");
console.log("PWA verified: manifest, PNG icons, scoped paths, offline app shell.");
