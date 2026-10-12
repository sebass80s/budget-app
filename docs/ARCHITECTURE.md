# Budget App · Architecture v0.1

## Product rules
- A turn is a calendar day. **Daily net** is regular income minus regular expenses, normalized to one day.
- Variable transactions are manually recorded. **Never record a fixed item both as a recurring rule and as a manual transaction.**
- Virtual balance = opening virtual balance at the anchor date + each day's daily net + manual transactions.
- Virtual balance is *not* a bank balance. No bank feeds in the MVP.
- Future projections assume no future discretionary spending. They are not bank liquidity forecasts.
- The monthly ledger shows one row per calendar day, including future days as projections. Visible columns are date, manually recorded event net, daily result and virtual running balance. Recurring income and fixed costs still feed daily result but are deliberately hidden in this view, including expanded rows (which display only manual transactions). Monthly totals respect the workspace start date; days before the anchor show no balance.
- Amounts are integer öre. Dates are local calendar day strings (YYYY-MM-DD); iteration is timezone-independent UTC math.
- Smoothed daily rate: monthly amount × 12 / 365.2425; weekly amount / 7; quarterly ×4 / 365.2425; yearly /365.2425. Round to nearest öre per recurring rule. This is not an exact cash-date simulation.
- Expiring recurring entries stay in the dataset. Edit recurring amounts through effective-dated revisions, not retrospective overwrites.

## Ownership model
- `workspaces` is an economy, initially one personal workspace.
- `members` attaches people to a workspace; initially one owner.
- `recurring` and `transactions` both carry `workspaceId` and optional `memberId`.
- A future shared-household mode can support several members and personal/shared accounts without migrating ownership assumptions.
- Document `schemaVersion` is required for data migrations.

## Delivery
- Source control, testing, and production deployment stay entirely on GitHub; users do not need a local checkout.
- Pull requests run `verify.yml`: type checks, unit tests and export build.
- Main branch runs `deploy-pages.yml`: tests, static Next.js export and publish to GitHub Pages.
- GitHub Pages requires a one-time repo Settings → Pages → Build and deployment → Source: GitHub Actions selection.
- Published URL: https://sebass80s.github.io/budget-app/ once Pages is enabled.
- GitHub Pages is a static website, not a remote database. Server-only Next.js features are deliberately unavailable.

## Data, privacy and limitations
- MVP stores local data in **this browser's localStorage**, not GitHub or a server.
- No accounts, authentication, real synchronization, sharing or encryption in MVP.
- Export backup JSON and restore it via import. Local data can be cleared by the browser; do not rely on it without backup.
- Demo fixtures contain no real financial data.
- Public repository contains only sample data. Environment variables are ignored.
- Before adding real multiuser sync: backend authorization, row-level access policies, tenant isolation, tested migrations, encrypted transport, and server-side backups are required.

## Future
1. Versioned persistence backend and authenticated personal workspace
2. Actual account balances and bank reconciliation in a **separate ledger**
3. Shared economy members and permissions
4. Import/export version upgrades and auditing
