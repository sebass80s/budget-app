import test from "node:test";
import assert from "node:assert/strict";
import { createDemoBudget, createEmptyBudget } from "../src/lib/budget.ts";
import { chooseCloudStartup } from "../src/lib/cloud-startup.ts";
test("new account gets an empty cloud budget without demo", () => {
  assert.equal(chooseCloudStartup(null, null, null), "create-cloud");
  assert.equal(chooseCloudStartup(createDemoBudget("2026-10-12"), null, null), "create-cloud");
});
test("signed-in account cloud loads automatically on fresh device or previously synced device", () => {
  const cloud = createEmptyBudget("2026-10-12");
  const old = createEmptyBudget("2026-10-11");
  assert.equal(chooseCloudStartup(null, cloud, null), "load-cloud");
  assert.equal(chooseCloudStartup(cloud, cloud, null), "load-cloud");
  assert.equal(chooseCloudStartup(old, cloud, JSON.stringify(old)), "load-cloud");
  assert.equal(chooseCloudStartup(createDemoBudget("2026-10-12"), cloud, null), "load-cloud");
});
test("unlinked real local budget needs approval before upload or replacement", () => {
  const local = createEmptyBudget("2026-10-11");
  const cloud = createEmptyBudget("2026-10-12");
  assert.equal(chooseCloudStartup(local, cloud, null), "review-local");
  assert.equal(chooseCloudStartup(local, null, null), "review-local");
});
