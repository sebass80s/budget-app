import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyBudget, validDocument } from "../src/lib/budget.ts";
import {
  needsOnboarding, resumeOnboarding, addSetupEntry, finishOnboarding, setInitialTurnsBalance,
} from "../src/lib/onboarding.ts";

const makeNew = () => ({
  ...createEmptyBudget("2026-10-12"),
  onboarding: { version: 1, completed: false },
});
test("only marked new accounts start onboarding; existing even empty budgets are left alone", () => {
  const old = createEmptyBudget("2026-10-12");
  assert.equal(needsOnboarding(old), false);
  assert.equal(needsOnboarding({...old, transactions:[{
    id:"old",workspaceId:"personal",memberId:"owner",label:"Kaffe",amountOre:-3500,
    bookedOn:"2026-10-12",createdAt:"2026-10-12T12:00:00Z",
  }]}), false);
  assert.equal(needsOnboarding(makeNew()), true);
});
test("setup saves regular monthly entries with correct signs and without touching old budget", () => {
  const original = makeNew();
  const income = addSetupEntry(original, {
    id:"setup-income",kind:"income",label:" Lön ",amount:"30 000,00",day:"2026-10-12",
  });
  assert.equal(original.recurring.length,0);
  assert.equal(income.recurring[0].amountOre,3000000);
  assert.equal(income.recurring[0].cadence,"monthly");
  assert.equal(income.recurring[0].label,"Lön");
  const cost=addSetupEntry(income,{id:"setup-rent",kind:"expense",label:"Hyra",amount:"7500",day:"2026-10-12"});
  assert.equal(cost.recurring[1].amountOre,-750000);
  assert.equal(cost.recurring[1].cadence,"monthly");
  assert.equal(cost.recurring.length,2);
  assert.equal(validDocument(cost),true);
  assert.equal(resumeOnboarding(income),"costs");
  assert.equal(resumeOnboarding(cost),"start");
  assert.equal(resumeOnboarding(setInitialTurnsBalance(cost,"2026-10-12","8000")),"ready");
});
test("setup entry validates data and handles a repeated transaction id safely", () => {
  const original=makeNew();
  const input={id:"x",kind:"expense",label:"El",amount:"600",day:"2026-10-12"};
  const once=addSetupEntry(original,input);
  assert.equal(addSetupEntry(once,input).recurring.length,1);
  assert.throws(()=>addSetupEntry(original,{...input,amount:"0"}),/giltigt belopp/);
  assert.throws(()=>addSetupEntry(original,{...input,label:" "}),/Beskrivningen/);
  assert.throws(()=>addSetupEntry(original,{...input,day:"2026-02-30"}),/Ogiltigt datum/);
});
test("finish and skip store completion in Firebase document; original data survives", () => {
  const pending=makeNew();
  const completed=finishOnboarding(setInitialTurnsBalance(pending,"2026-10-12","0"));
  assert.equal(completed.onboarding.completed,true);
  assert.equal(needsOnboarding(completed),false);
  assert.equal(pending.onboarding.completed,false);
  assert.equal(validDocument(completed),true);
  assert.equal(validDocument({...completed,onboarding:{version:2,completed:true}}),false);
  assert.equal(validDocument({...completed,onboarding:{version:1,completed:"yes"}}),false);
});
