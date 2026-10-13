import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays, daysBetween, kronaToOre, createDemoBudget, createEmptyBudget,
  dailyAccrualOre, dailyNetOre, dailyResultOre, rangeResultOre,
  virtualBalanceOre, mondayOnOrBefore, validDocument, replaceRecurringFrom, monthStart, nextMonth
} from "../src/lib/budget.ts";

test("dates are timezone-independent, including leap days", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
  assert.equal(daysBetween("2026-10-01", "2026-10-12"), 11);
  assert.equal(mondayOnOrBefore("2026-10-12"), "2026-10-12");
});
test("SEK amounts are parsed into integer öre only", () => {
  assert.equal(kronaToOre("125,50"), 12550);
  assert.equal(kronaToOre("1 200.25"), 120025);
  assert.equal(kronaToOre("12.345"), null);
  assert.equal(kronaToOre("-10"), null);
});
test("periodic sums become a daily net and ignore future items", () => {
  const d = createEmptyBudget("2026-10-12");
  d.recurring = [{ id:"salary", workspaceId:"personal", memberId:"owner", label:"Lön", amountOre:3000000, cadence:"monthly", startsOn:"2026-10-13", endsOn:null }];
  assert.equal(dailyNetOre(d,"personal","2026-10-12"),0);
  assert.equal(dailyAccrualOre(d.recurring[0]), Math.round(3000000 * 12 / 365.2425));
  assert.equal(dailyNetOre(d,"personal","2026-10-13"),dailyAccrualOre(d.recurring[0]));
});
test("transactions affect only their booked day, and never double-count fixed bills", () => {
  const d = createEmptyBudget("2026-10-12");
  d.recurring=[{ id:"rent", workspaceId:"personal", memberId:"owner", label:"Boende", amountOre:-900000, cadence:"monthly", startsOn:"2026-10-12", endsOn:null }];
  d.transactions=[{ id:"coffee", workspaceId:"personal", memberId:"owner", label:"Kaffe", amountOre:-4500, bookedOn:"2026-10-12", createdAt:"2026-10-12T12:00:00Z" }];
  assert.equal(dailyResultOre(d,"personal","2026-10-12"),dailyAccrualOre(d.recurring[0])-4500);
  assert.equal(dailyResultOre(d,"personal","2026-10-13"),dailyAccrualOre(d.recurring[0]));
});
test("balance starts at chosen anchor and respects workspace isolation", () => {
  const d = createEmptyBudget("2026-10-12");
  d.workspaces[0].openingBalanceOre=100000;
  d.transactions=[{id:"one",workspaceId:"personal",memberId:"owner",label:"Köp",amountOre:-2000,bookedOn:"2026-10-12",createdAt:"x"}];
  assert.equal(virtualBalanceOre(d,"personal","2026-10-11"),100000);
  assert.equal(virtualBalanceOre(d,"personal","2026-10-12"),98000);
  assert.equal(virtualBalanceOre(d,"other","2026-10-12"),0);
  assert.equal(rangeResultOre(d,"personal","2026-10-11","2026-10-12"),-2000);
});
test("revisions stop the previous rate without rewriting history", () => {
  const d = createEmptyBudget("2026-10-01");
  d.recurring=[{id:"a",workspaceId:"personal",memberId:"owner",label:"Lön",amountOre:1000000,cadence:"monthly",startsOn:"2026-10-01",endsOn:null}];
  const before=dailyNetOre(d,"personal","2026-10-10");
  const changed=replaceRecurringFrom(d,"a","2026-10-11",2000000);
  assert.equal(dailyNetOre(changed,"personal","2026-10-10"),before);
  assert.equal(dailyNetOre(changed,"personal","2026-10-11"),Math.round(2000000*12/365.2425));
  assert.equal(changed.recurring.length,2);
  assert.equal(d.recurring[0].endsOn,null);
});
test("demo and empty documents are valid", () => {
  assert.equal(validDocument(createDemoBudget("2026-10-12")),true);
  assert.equal(validDocument(createEmptyBudget("2026-10-12")),true);
  assert.equal(validDocument({schemaVersion:99}),false);
});

test("first-month TURNS use only money remaining, ignoring recurring amounts", () => {
  const d = createEmptyBudget("2026-10-13");
  d.workspaces[0].turnsStart = { day: "2026-10-13", availableOre: 800000 };
  d.recurring = [
    {id:"salary", workspaceId:"personal", memberId:"owner",label:"Lön", amountOre:3000000,cadence:"monthly", startsOn:"2026-11-01",endsOn:null},
    {id:"rent", workspaceId:"personal", memberId:"owner",label:"Hyra", amountOre:-1200000,cadence:"monthly", startsOn:"2026-11-01",endsOn:null},
  ];
  let total = 0;
  for (let day="2026-10-13"; day<="2026-10-31"; day=addDays(day,1)) total+=dailyNetOre(d,"personal",day);
  assert.equal(total, 800000);
  assert.equal(dailyNetOre(d,"personal","2026-10-12"), 0);
  assert.equal(virtualBalanceOre(d,"personal","2026-10-31"), 800000);
  let november = 0;
  for (let day="2026-11-01";day<="2026-11-30";day=addDays(day,1)) november+=dailyNetOre(d,"personal",day);
  assert.equal(november,1800000);
  assert.equal(virtualBalanceOre(d,"personal","2026-11-30"),1800000);
  assert.equal(validDocument(d),true);
});

test("monthly TURNS never carry surplus from previous month", () => {
  const d=createEmptyBudget("2026-10-13");
  d.workspaces[0].turnsStart={day:"2026-10-13",availableOre:800000};
  d.recurring=[{id:"salary",workspaceId:"personal",memberId:"owner",label:"Lön",amountOre:3000000,cadence:"monthly",startsOn:"2026-11-01",endsOn:null}];
  d.transactions=[{id:"groceries", workspaceId:"personal", memberId:"owner",label:"Mat",amountOre:-500000,bookedOn:"2026-10-13",createdAt:"x"}];
  assert.equal(virtualBalanceOre(d,"personal","2026-10-31"),300000);
  assert.equal(virtualBalanceOre(d,"personal","2026-11-01"),dailyNetOre(d,"personal","2026-11-01"));
  assert.equal(nextMonth("2026-12-31"),"2027-01-01");
  assert.equal(monthStart("2026-10-19"),"2026-10-01");
});

test("opt-in on existing account preserves older dates but resets balance from chosen day",()=>{
  const d=createEmptyBudget("2026-09-01");
  d.recurring=[{id:"rent",workspaceId:"personal",memberId:"owner",label:"Rent",amountOre:-100000,cadence:"monthly",startsOn:"2026-09-01",endsOn:null}];
  const oldSep=dailyNetOre(d,"personal","2026-09-15");
  const oldOct=dailyNetOre(d,"personal","2026-10-12");
  d.workspaces[0].turnsStart={day:"2026-10-13",availableOre:500000};
  assert.equal(dailyNetOre(d,"personal","2026-09-15"),oldSep);
  assert.equal(dailyNetOre(d,"personal","2026-10-12"),oldOct);
  assert.equal(virtualBalanceOre(d,"personal","2026-10-12"),rangeResultOre(d,"personal","2026-09-01","2026-10-12"));
  assert.equal(virtualBalanceOre(d,"personal","2026-10-31"),500000);
});
