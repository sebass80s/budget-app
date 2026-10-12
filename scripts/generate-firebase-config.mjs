import { writeFile } from "node:fs/promises";
const raw = process.env.FIREBASE_CONFIG_JSON?.trim();
let config = { enabled: false };
if (raw) {
  const parsed = JSON.parse(raw);
  for (const field of ["apiKey","authDomain","projectId","appId"]) {
    if (typeof parsed[field] !== "string" || !parsed[field]) {
      throw new Error("FIREBASE_CONFIG_JSON missing " + field);
    }
  }
  config = {
    enabled:true, apiKey:parsed.apiKey, authDomain:parsed.authDomain,
    projectId:parsed.projectId, appId:parsed.appId,
    messagingSenderId:parsed.messagingSenderId || "",
  };
}
await writeFile("public/firebase-config.json",JSON.stringify(config,null,2)+"\n");
console.log(config.enabled ? "Firebase web configuration enabled." : "Firebase not configured; local budget remains available.");
