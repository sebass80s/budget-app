import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBudget, dailyNetOre } from "../src/lib/budget.ts";
import { setInitialTurnsBalance, addSetupEntry, finishOnboarding, resumeOnboarding } from "../src/lib/onboarding.ts";

test("new account setup captures start once and activates fixed costs next month", () => {
  const d = createEmptyBudget("2026-10-13");
  d.onboarding={version:1,completed:false};
  const withIncome=addSetupEntry(d,{kind:"income",label:"Lön",amount:"30000",day:"2026-10-13",id:"income"});
  assert.equal(withIncome.recurring[0].startsOn,"2026-11-01");
  const withCosts=addSetupEntry(withIncome,{kind:"expense",label:"Hyra",amount:"12000",day:"2026-10-13",id:"rent"});
  assert.equal(resumeOnboarding(withCosts),"start");
  assert.throws(()=>finishOnboarding(withCosts),/startbudget/i);
  const withStart=setInitialTurnsBalance(withCosts,"2026-10-13","8000");
  assert.equal(withStart.workspaces[0].turnsStart.availableOre,800000);
  assert.equal(dailyNetOre(withStart,"personal","2026-10-13")>0,true);
  assert.equal(resumeOnboarding(withStart),"ready");
  assert.equal(finishOnboarding(withStart).onboarding.completed,true);
  assert.throws(()=>setInitialTurnsBalance(finishOnboarding(withStart),"2026-10-13","9999"));
});

test("start amount does not alter existing accounts",()=>{
  const legacy=createEmptyBudget("2026-10-13");
  assert.throws(()=>setInitialTurnsBalance(legacy,"2026-10-13","500"),/konto/i);
});
