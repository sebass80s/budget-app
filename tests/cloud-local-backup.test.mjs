import test from "node:test";
import assert from "node:assert/strict";
import { createDemoBudget, createEmptyBudget } from "../src/lib/budget.ts";
import { localCloudBackupKey, preserveLocalCloudBackup, readLocalCloudBackup } from "../src/lib/cloud-local-backup.ts";
const mem = () => { const entries = new Map(); return {
  getItem: key => entries.has(key) ? entries.get(key) : null,
  setItem: (key, val) => { entries.set(key, String(val)); },
}; };
test("old local budget survives cloud restore without file download", () => {
  const store = mem(); const local = createEmptyBudget("2026-10-12");
  local.transactions.push({id:"t", workspaceId:"personal",memberId:null,label:"Coffee",amountOre:-1200,bookedOn:"2026-10-12",createdAt:"2026-10-12T12:00:00.000Z"});
  const cloud = createEmptyBudget("2026-10-13");
  assert.equal(preserveLocalCloudBackup(store,"u1",local,cloud),true);
  assert.deepEqual(readLocalCloudBackup(store,"u1"),local);
  assert.equal(store.getItem(localCloudBackupKey("u2")),null);
});
test("demo and identical budgets need no backup; existing local backup is preserved", () => {
  const store = mem(), local = createEmptyBudget("2026-10-12"),cloud = createEmptyBudget("2026-10-13");
  assert.equal(preserveLocalCloudBackup(store,"u1",createDemoBudget("2026-10-12"),cloud),false);
  assert.equal(preserveLocalCloudBackup(store,"u1",local,local),false);
  assert.equal(store.getItem(localCloudBackupKey("u1")),null);
  assert.equal(preserveLocalCloudBackup(store,"u1",local,cloud),true);
  const first=store.getItem(localCloudBackupKey("u1"));
  assert.equal(preserveLocalCloudBackup(store,"u1",cloud,local),true);
  assert.equal(store.getItem(localCloudBackupKey("u1")),first);
});
test("invalid stored backup must be rejected", () => {
  const store=mem(); store.setItem(localCloudBackupKey("u1"), '{"wrong":true}');
  assert.throws(()=>readLocalCloudBackup(store,"u1"),/ogiltigt format/);
});
