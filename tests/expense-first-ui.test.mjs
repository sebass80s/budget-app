import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyBudget, dailyNetOre, dailyResultOre, kronaToOre } from "../src/lib/budget.ts";

const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
test("expense-first layout exposes three destinations with today expenses on Home", () => {
  const nav = page.match(/const nav:[\s\S]*?= \[([\s\S]*?)\];/)?.[1] ?? "";
  assert.deepEqual([...nav.matchAll(/id: "([^"]+)"/g)].map(x => x[1]), ["new", "monthly", "settings"]);
  assert.match(page, /Lägg till utgift/);
  assert.match(page, /Dagens utgifter/);
});
test("settings host monthly income and fixed-cost forms without a separate recurring page", () => {
  assert.match(page, /Min inkomst/);
  assert.match(page, /Fasta kostnader/);
  assert.match(page, /addFixed\(event, "income"\)/);
  assert.match(page, /addFixed\(event, "expense"\)/);
  assert.match(page, /cadence: "monthly"/);
  assert.doesNotMatch(page, /tab === "recurring"/);
});
test("income and fixed cost contribute to daily budget while a purchase reduces it", () => {
  const doc = createEmptyBudget("2026-10-12");
  doc.recurring = [
    { id: "salary", label: "Lön", amountOre: 3000000, cadence: "monthly", startsOn: "2026-10-12", endsOn: null, workspaceId: "personal", memberId: "owner" },
    { id: "rent", label: "Hyra", amountOre: -800000, cadence: "monthly", startsOn: "2026-10-12", endsOn: null, workspaceId: "personal", memberId: "owner" },
  ];
  doc.transactions = [
    { id: "lunch", label: "Lunch", amountOre: -12000, bookedOn: "2026-10-12", workspaceId: "personal", memberId: "owner", createdAt: "2026-10-12T18:00:00Z" },
  ];
  assert.equal(dailyResultOre(doc,"personal","2026-10-12"),dailyNetOre(doc,"personal","2026-10-12")-12000);
  assert.equal(kronaToOre("120,50"),12050);
});

test("today's expenses open by default; monthly expansion chevron stays beside date", () => {
  const month = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/app/month.css", import.meta.url), "utf8");
  assert.match(page, /useState<Tab>\("new"\)/);
  const labelIndex = month.indexOf('<span className="month-day-label">');
  const arrowIndex = month.indexOf('<span className="day-chevron"');
  assert.ok(arrowIndex >= 0 && labelIndex > arrowIndex, "arrow should precede date text inside the same clickable button");
  assert.match(styles, /\.month-day-button\{display:inline-flex;justify-content:flex-start/);
  assert.match(styles, /\.month-table thead th:first-child,\.month-table tbody \.month-data-row th:first-child/);
});

test("new expense view displays live daily result above the expense form", () => {
  const start = page.indexOf('{tab === "new" && <div className="simple-home">');
  const result = page.indexOf('className="day-result-card"', start);
  const expense = page.indexOf('className="panel quick-expense-panel"', start);
  assert.ok(start >= 0 && result > start && expense > result, "Daily result should appear above expense entry");
  assert.match(page, /dailyResultOre\(document, workspaceId, expenseDay\)/);
  assert.match(page, /selectedDayResult < 0 \? " is-negative" : ""/);
  assert.match(page, /selectedDayResult > 0 \? "\+" : ""/);
  assert.match(page, /useState<Tab>\("new"\)/, "Today's expenses remains the default view");
});


test("UX: date refreshes on app foreground without changing a manually selected historical date", () => {
  assert.match(page, /window\.document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(page, /window\.addEventListener\("focus", refreshDay\)/);
  assert.match(page, /setExpenseDay\(previous => previous === lastToday \? current : previous\)/);
  assert.match(page, /window\.document\.removeEventListener\("visibilitychange", onVisibilityChange\)/);
});
test("UX: result follows selected date, date remains accessible and amount is focused", () => {
  assert.match(page, /dailyResultOre\(document, workspaceId, expenseDay\)/);
  assert.match(page, /RESULTAT FÖR VALD DAG/);
  assert.match(page, /<details className="expense-date-options" open=\{!isTodayExpense\}>/);
  assert.match(page, /ref=\{amountInput\} id="expense-amount"/);
});
test("UX: reduce status clutter, enlarge mobile controls, and explain month scrolling", () => {
  const stylesheet = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const monthMarkup = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  assert.match(page, /includes\(cloud\.message\) \? "" : cloud\.message/);
  assert.match(stylesheet, /\.icon-button\{min-width:44px;width:44px;height:44px/);
  assert.match(stylesheet, /\.mobile-nav-item\{min-height:44px\}/);
  assert.match(monthMarkup, /Tryck på en dag för att se eller ändra utgifter och engångsinkomster/);
});


test("existing expense correction is reachable from daily expenses and opened monthly days", () => {
  const month = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../src/components/ExpenseEditor.tsx", import.meta.url), "utf8");
  assert.match(page, /const \[editingTodayId, setEditingTodayId\] = useState/);
  assert.match(page, /onEditTransaction=\{saveExpenseEdit\}/);
  assert.match(page, /updateOneTimeIncome\(doc, original, changes\) : updateExpense\(doc, original, changes\)/);
  assert.match(page, /<ExpenseEditor transaction=\{item\}/);
  assert.match(month, /t\.amountOre !== 0 && <button/);
  assert.match(month, /<ExpenseEditor transaction=\{t\}/);
  assert.match(editor, /const original = useRef\(transaction\)/);
  assert.match(editor, /onSave\(original\.current, \{ amount, label, bookedOn \}\)/);
  assert.match(editor, /Spara ändringar/);
  assert.match(editor, /Avbryt/);
});


test("new account onboarding opens only from Firebase marker and existing accounts can revisit", () => {
  const setup=readFileSync(new URL("../src/components/Onboarding.tsx", import.meta.url), "utf8");
  const hook=readFileSync(new URL("../src/hooks/useCloudSync.ts", import.meta.url), "utf8");
  assert.match(hook,/onboarding: \{ version: 1, completed: false \}/);
  assert.match(page,/if \(needsOnboarding\(document\) \|\| showSetupGuide\)/);
  assert.match(page,/cloud\.saveBudget\(finishOnboarding\)/);
  assert.match(page,/Visa introduktionen/);
  assert.match(setup,/Hur mycket har du kvar just nu/);
  assert.match(setup,/Spara och fortsätt/);
  assert.match(setup,/Spara kostnad/);
  assert.match(setup,/Lägg till min första utgift/);
});


test("mobile expense views fit the viewport instead of adding horizontal scroll", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const fix = css.slice(css.indexOf("/* Mobile overflow fix:"));
  assert.ok(fix.length > 100, "mobile overflow rules are present");
  assert.match(fix, /@media\(max-width:760px\)/);
  assert.match(fix, /\.mobile-nav\{\s*display:grid;\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(fix, /overflow:visible/);
  assert.match(fix, /\.mobile-nav-item\{\s*min-width:0;/);
  assert.match(fix, /white-space:normal/);
  assert.match(fix, /\.daily-expenses,\.simple-home,\.daily-summary/);
  assert.match(fix, /\.quick-expense-form label,\.quick-expense-form input,\.expense-date-options/);
  assert.match(fix, /\.today-preview>strong\{min-width:0;/);
  assert.match(fix, /\.expense-item>\.list-row>\.list-row-right\{/);
  assert.doesNotMatch(fix, /html\s*,\s*body\s*\{[^}]*overflow-x:\s*hidden/s,
    "do not mask the overflow by clipping the entire document");
  const month = readFileSync(new URL("../src/app/month.css", import.meta.url), "utf8");
  assert.match(month, /\.month-scroll\{max-width:100%;overflow-x:auto/);
});

test("month ledger shows all values as no-scroll day cards on phone", () => {
  const css = readFileSync(new URL("../src/app/month.css", import.meta.url), "utf8");
  const markup = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  const mobile = css.slice(css.indexOf("/* Phone month table:"));
  assert.match(mobile, /@media\(max-width:760px\)/);
  assert.match(mobile, /\.month-scroll\{overflow-x:visible;/);
  assert.match(mobile, /\.month-table\{display:block;width:100%;min-width:0;white-space:normal\}/);
  assert.match(mobile, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  for (const label of ["Registrerat","Dagsresultat","Budgetsaldo"]) {
    assert.ok(mobile.includes('content:"'+label+'"'));
  }
  assert.match(mobile, /\.month-table \.month-details-row>td/);
  assert.match(markup, /Tryck på en dag för att se eller ändra dina utgifter/);
  assert.doesNotMatch(markup, /Svep tabellen i sidled/);
});

test("monthly view shows only ledger and month picker, without top forecast cards or new-expense button", () => {
  const month = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(month, /className="month-summary"/);
  assert.doesNotMatch(month, /Resultat inkl\. prognos/);
  assert.match(month, /className="month-picker"/);
  assert.match(month, /className="month-table"/);
  assert.match(page, /tab !== "monthly" && <button type="button" className="button button-secondary"/);
});

test("create-account button opens its own registration screen with confirmed password", () => {
  const auth = readFileSync(new URL("../src/components/CloudPanel.tsx", import.meta.url), "utf8");
  assert.match(auth, /useState<"login" \| "register">\("login"\)/);
  assert.match(auth, /onClick=\{\(\) => changeScreen\("register"\)\}/);
  assert.match(auth, /Bekräfta lösenord/);
  assert.match(auth, /password !== confirmPassword/);
  assert.match(auth, /onSubmit=\{event => \{ event\.preventDefault\(\); void submit\(true\); \}\}/);
  assert.match(auth, /onClick=\{\(\) => changeScreen\("login"\)\}/);
});

test("global Home opens the same quick expense screen as the logo", () => {
  assert.match(page, /id: "new", label: "Hem"/);
  assert.equal((page.match(/item\.id === "new" \? newExpense\(\) : show\(item\.id\)/g) || []).length, 2);
  assert.ok((page.match(/onClick=\{\(\) => newExpense\(\)\}/g) || []).length >= 2);
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("mobile header has no redundant + Utgift button", () => {
  assert.doesNotMatch(page, /className="mobile-expense-action"/);
  assert.match(page, /className="brand brand-home" aria-label="Registrera en ny utgift"/);
});

test("today expenses list follows the add expense form on Home without a separate tab", () => {
  const home = page.indexOf('{tab === "new" && <div className="simple-home">');
  const form = page.indexOf('className="panel quick-expense-panel"', home);
  const today = page.indexOf('<h2>Dagens utgifter</h2>', home);
  const month = page.indexOf('{tab === "monthly"', home);
  assert.ok(home >= 0 && form > home && today > form && month > today);
  assert.doesNotMatch(page, /tab === "today"/);
  assert.doesNotMatch(page, /id: "today", label: "Dagens utgifter"/);
  assert.match(page, /todaysExpenses\.map\(item =>/);
  assert.match(page, /<ExpenseEditor transaction=\{item\}/);
});


test("installed PWA checks for new versions on reopen and reloads when new worker takes over", () => {
  const sw = readFileSync(new URL("../src/components/PwaRegistration.tsx", import.meta.url), "utf8");
  assert.match(sw, /updateViaCache: "none"/);
  assert.match(sw, /await registration\.update\(\)/);
  assert.match(sw, /addEventListener\("visibilitychange", onReturn\)/);
  assert.match(sw, /addEventListener\("focus", onFocus\)/);
  assert.match(sw, /addEventListener\("controllerchange", onControllerChange\)/);
  assert.doesNotMatch(sw, /const hadController\s*=/);
  assert.match(sw, /reloading\s*=\s*true;\s*window\.location\.reload\(\)/);
  assert.match(sw, /removeEventListener\("controllerchange", onControllerChange\)/);
  assert.match(sw, /if \(cancelled \|\| updating \|\| !registration \|\| !navigator\.onLine\) return/);
});


test("Agile Economy branding and clearer expense editing", () => {
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
  const editor = readFileSync(new URL("../src/components/ExpenseEditor.tsx", import.meta.url), "utf8");
  const monthly = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  assert.equal(manifest.name, "Agile Economy");
  assert.equal(manifest.short_name, "Agile Economy");
  assert.ok(layout.includes('applicationName: "Agile Economy"'));
  assert.ok(layout.includes('title: "Agile Economy"'));
  assert.ok(page.includes("Agile<span> Economy</span>"));
  assert.ok(editor.includes("Namn på utgiften"));
  assert.ok(page.includes("Ändra namn / belopp"));
  assert.ok(monthly.includes("Ändra namn / belopp"));
});

test("Home shows remaining spendable money after daily result, not accrued month-to-date profit", () => {
  const home = page.indexOf('{tab === "new" && <div className="simple-home">');
  const daily = page.indexOf('id="day-result-heading"', home);
  const monthly = page.indexOf('id="month-result-heading"', home);
  const form = page.indexOf('className="panel quick-expense-panel"', home);
  assert.ok(home >= 0 && daily > home && monthly > daily && form > monthly);
  assert.ok(page.includes('remainingMonthBudgetOre(document, workspaceId, today)'));
  assert.match(page, /KVAR ATT SPENDERA DENNA MÅNAD/);
  assert.match(page, /Kommande dagars budget ingår/);
  assert.doesNotMatch(page, /MÅNADENS RESULTAT|Hittills denna månad/);
});

test("new accounts start with plain-language onboarding; existing accounts opt in without TURNS jargon", () => {
  const setup = readFileSync(new URL("../src/components/Onboarding.tsx", import.meta.url), "utf8");
  const cloud = readFileSync(new URL("../src/hooks/useCloudSync.ts", import.meta.url), "utf8");
  const onboarding = readFileSync(new URL("../src/lib/onboarding.ts", import.meta.url), "utf8");

  // The Firestore marker causes the setup screen to appear before the main interface.
  assert.match(cloud, /onboarding: \{ version: 1, completed: false \}/);
  assert.match(page, /if \(needsOnboarding\(document\) \|\| showSetupGuide\)/);
  assert.match(page, /return <Onboarding document=\{document\}/);
  assert.match(onboarding, /doc\.onboarding\?\.version === 1 && doc\.onboarding\.completed === false/);

  // A legacy user sees an optional one-time switch, not the new-user tutorial.
  assert.match(page, /!workspace\.turnsStart && <section className="panel form-panel">/);
  assert.match(page, /Kom igång med din dagsbudget/);
  assert.match(page, /Starta min dagsbudget/);
  assert.match(setup, /Följ din dagsbudget och registrera utgifter/);
  assert.match(setup, /Varje dag har du en dagsbudget/);

  // Product concepts stay in the internal model, never in user-facing TSX text.
  for (const [name, source] of [["Hem", page], ["Introduktionen", setup]]) {
    assert.doesNotMatch(source, /\bTURNS?\b/, name + " must not show internal terminology");
    assert.doesNotMatch(source, /månadsspara/i, name + " must not mislabel budgeting as saving");
  }
});

test("one-off income is an optional Home action saved separately from expenses", () => {
  const model = readFileSync(new URL("../src/lib/one-time-income.ts", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../src/components/ExpenseEditor.tsx", import.meta.url), "utf8");
  const month = readFileSync(new URL("../src/components/MonthlyTable.tsx", import.meta.url), "utf8");
  assert.match(page, /<summary>\+ Lägg till extra pengar/);
  assert.match(page, /onSubmit=\{addExtraMoney\}/);
  assert.match(page, /cloud\.saveBudget\(doc => addOneTimeIncome\(doc, entry\)\)/);
  assert.match(page, /Lägg till pengarna/);
  assert.match(page, /todaysIncomes\.map\(item =>/);
  assert.match(page, /deleteOneTimeIncome\(item\)/);
  assert.match(page, /updateOneTimeIncome\(doc, original, changes\)/);
  assert.match(model, /amountOre: ore/);
  assert.doesNotMatch(model, /recurring:/);
  assert.match(editor, /Ändra engångsinkomst/);
  assert.match(month, /t\.amountOre > 0 \? "engångsinkomst" : "utgift"/);
  assert.match(month, /t\.amountOre !== 0 && <button/);
});
