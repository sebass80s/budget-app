# Budget App

En personlig budget inspirerad av [Civilization-budgetering](https://archive.alexrecker.com/civ-budget.html): **ett dagligt grundnetto, en händelse i taget**.

## Webbversion

Appen byggs och publiceras helt i molnet av **GitHub Actions + GitHub Pages**. Ingen lokal installation eller terminal behövs för att använda den.

**Webbadress efter att GitHub Pages har aktiverats:**
https://sebass80s.github.io/budget-app/

### Engångsinställning för den som äger repot

1. Öppna [Settings → Pages](https://github.com/sebass80s/budget-app/settings/pages).
2. Under **Build and deployment**, välj **GitHub Actions** som **Source**. Spara om en Save-knapp visas.
3. Öppna [Actions → Deploy to GitHub Pages](https://github.com/sebass80s/budget-app/actions/workflows/deploy-pages.yml) och välj **Run workflow** med branch **main** om den inte redan har publicerats.
4. Kontrollera att både `Test and export website` och `Publish website` är gröna.
5. Öppna webbadressen ovan.

Därefter publiceras varje uppdatering på `main` automatiskt via GitHub Actions. Pull requests kör separat test/typkontroll/build utan att publicera. För statisk publicering används Next.js `output: "export"` samt base path `/budget-app`.

## Vad finns?

- Dagsnetto beräknat från återkommande inkomster och fasta utgifter: per vecka, månad, kvartal eller år.
- Registrera rörliga utgifter och extra inkomster i ören, med datum.
- **Månadsvy:** en tabellrad för varje datum, med fasta inkomster, fasta utgifter, rörliga poster, dagsresultat och löpande budgetsaldo. Bläddra mellan månader och fäll ut en dag för att se underlaget.
- Beräknat budgetsaldos utveckling, dags-, vecko-, månadsresultat samt enkel 30-dagarsprognos.
- Återkommande poster får effektiva start- och slutdatum; beloppsändring skapar ny version.
- Lokal lagring samt import och export av JSON-säkerhetskopior.
- Mobilvänligt gränssnitt. Ett personligt konto nu, datafält för flera medlemmar senare.

### Viktig skillnad: webbpublicering och datalagring

**Webbappen är online, men ekonomiska uppgifter sparas för närvarande bara i webbläsaren där du använder appen.** Safari på iPhone och Chrome på en annan dator har alltså separata budgetar. Det finns ännu ingen inloggning eller synkronisering mellan enheter. Appdata lagras okrypterat i webbläsarens `localStorage`, inte i GitHub eller GitHub Pages. Undvik riktiga personuppgifter på delade enheter, och exportera backup regelbundet.

**Beräknat budgetsaldo är inte ett bankkontosaldo.** Regelbundna belopp fördelas jämnt per dag. Faktiska löne- och betalningsdatum modelleras inte. Framtidsprognosen förutsätter inga framtida rörliga köp.

Arkitektur och framtida flerpersonsstöd: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

MIT-licens.
