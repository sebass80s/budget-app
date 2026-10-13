# AGILE ECONOMY – HANDOVER 2026-10-13

> **FIRST PRIORITY:** User reports **no visible change in installed iPhone PWA** after PR #29 added **Månadens resultat** beneath **Dagens resultat**. Do not assume the issue is fixed or caused by cache without checking.

## Verified production state (before this docs commit)

- Repo: https://github.com/sebass80s/budget-app
- Web/PWA: https://sebass80s.github.io/budget-app/
- Default branch: `main`; verified HEAD: `8b0625377181ee491467b0597724cf0eae3bf15d`
- Pages workflow #38430799126: **SUCCESS**, matches that SHA.
- PR #29: https://github.com/sebass80s/budget-app/pull/29
- Checked source on main: `src/app/page.tsx` **contains** `id="month-result-heading"` and `const monthResult = document ? rangeResultOre(document, workspaceId, today.slice(0, 7) + "-01", today) : 0;`.
- **No fix or diagnosis** has yet been made for the user's report that the new UI cannot be seen. Deployment and source correctness do *not* prove iPhone UI freshness.

## First task for next instance

1. Reverify current `main`, commit SHA, workflow deployment and published site.
2. Determine whether the new card is visible in Safari vs installed iPhone PWA; ask one focused follow-up if necessary.
3. Inspect PWA registration `src/components/PwaRegistration.tsx` and generated SW in `scripts/generate-sw.mjs`. Current system registers worker with `updateViaCache: "none"`, explicitly checks at launch/focus/visibility and reloads after worker controller update. SW is fingerprint-versioned, caches static shell, and uses network-first navigation.
4. Inspect layout/styles if website also lacks the card. Avoid speculation and don't instruct reinstall/reset before knowing whether it is required.
5. If code fix: branch, tests, PR, green CI, merge, verify Pages and request user confirmation on iPhone.

## Non-negotiable product rules

- App brand: **Agile Economy**. Tagline: **Ett drag i taget**. UI in Swedish, simple and iPhone-first.
- **TURNS are days.** Primary information is day's available budget, immediately adjusted by recorded daily purchases. Not a bank account or pay-date cashflow tracker.
- **New user first month:** enter the amount genuinely left to spend after paid bills; subtract remaining unpaid bills before entering. Split over remaining days including today. Recurring income/fixed costs start *next month* to avoid charging already paid rent again.
- **Subsequent months:** month-specific recurring income minus fixed costs, distributed across days/TURNS.
- **No spillover:** previous month's surplus or deficit must **not** raise/lower new month's per-day allowance.
- **History stays historical:** past expense records, old rent rates and monthly results must not be overwritten by a later recurring-cost change. Recurring changes normally apply next month.
- Past monthly results may be displayed and summed as **separate history**, never folded into next month's daily allowance.
- Savings goals, accounts and complex analytics are potential **v2**, not current scope. Avoid feature creep.

## Current app UX

- Navigation: **Hem, Månadsvy, Inställningar**, default Hem.
- Home order after PR #29: **Dagens resultat**, **Månadens resultat** (month-to-date through today only), **Lägg till utgift**, **Dagens utgifter**.
- User can edit existing expense **name, amount and date** without deleting the expense; action now labeled **✎ Ändra namn / belopp**. From Home for today's expenses, or expanded day in Månadsvy for earlier ones.
- Month view presents each day, posted amount, day result and budget balance, responsive iPhone cards, expandable expense details and separate past month results.
- New-account onboarding has five screens: welcome, monthly income, fixed costs, one-time first-month starting spendable amount, ready. Start balance appears only in first-month setup.
- Existing accounts are not forced through onboarding or silently migrated. They may choose **Börja med månadsvisa TURNS** from Settings as an explicit opt-in, preserving prior days.
- Firebase Authentication and Firestore are in use; writes are server-confirmed via Firestore transactions and sync across devices. Never overwrite/reset budgets casually.
- PWA green wallet artwork original: `public/assets/budget-icon.png`, generated 180/192/512 icons via `scripts/generate-icons.mjs`. Manifest and iOS app title say Agile Economy; repository path/domain remain `budget-app`.

## Code map

- `src/lib/budget.ts`: budget model; optional workspace `turnsStart: {day, availableOre}` for monthly TURNS vs legacy; `dailyResultOre`, `rangeResultOre`, virtual balance.
- `src/lib/monthly.ts`, `src/components/MonthlyTable.tsx`: month ledger, UI, separate historic results.
- `src/lib/onboarding.ts`, `src/components/Onboarding.tsx`: first month, resume, Firebase-backed onboarding.
- `src/app/page.tsx`: app routes/tabs, daily and month-to-date result cards, expense input/editing, settings and existing-account opt-in.
- `src/components/ExpenseEditor.tsx`, `src/lib/expense-edits.ts`: conflict-safe expense correction.
- `src/hooks/useCloudSync.ts`, `src/lib/firebase-cloud.ts`: Firebase sync and server transactions.
- `src/components/PwaRegistration.tsx`, `scripts/generate-sw.mjs`, `scripts/verify-pwa.mjs`: PWA cache/update/versioning.
- `tests/*.test.mjs` and `npm run verify`: regression tests, TypeScript typecheck, build, PWA checks.

## Recent milestones

- PR #29, main `8b062537...`: Home's **Månadens resultat**; deployed SUCCESS, **user cannot yet see change**.
- PR #28, main `84e4798d...`: **Agile Economy** brand, clearer expense name edit.
- PR #27, main `1610eb45...`: monthly TURNS, first month balance, onboarding, history and existing-account opt-in.
- PR #26, main `79217d27...`: green wallet source art and generated icons.
- PR #25, main `b5fb6e6d...`: update installed PWA on new worker version.
- PR #24, main `d60f905a...`: today expenses moved onto Home, global nav reduced to 3.

## Working style

Verify before claiming. User wants direct GitHub implementation, automated tests, a green PR, merge and verified GitHub Pages, then a concise Swedish summary. Keep existing Firebase data safe. Minimize unnecessary CI pushes/deploys. Persona in discussions: **Mira**, playful but precise. Important distinction: **deployed successfully** is not the same as **verified by the user on their iPhone**.
