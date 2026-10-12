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

## Installera som PWA på mobil

**Budget App är en installerbar webbapp**, inte en App Store-app. Öppna
https://sebass80s.github.io/budget-app/ på din telefon.

- **iPhone (Safari):** Dela → Lägg till på hemskärmen → Lägg till.
- **Android (Chrome):** Meny → Installera app (eller Lägg till på startskärmen).
- Öppna därefter Budget från den nya appikonen. Den startar i eget fönster.
- Efter första online-besöket lagras själva webbappens kod för ett grundläggande **offline-läge**. Vid nästa uppkoppling kan en uppdatering laddas.

**Viktigt före installation:** Uppgifter ligger fortsatt i varje webbläsares lokala lagring, inte på en server. iOS kan lagra hemskärmsappar separat från Safari. Om du redan lagt in riktiga uppgifter i Safari, exportera en backup under Inställningar och importera den vid behov i den installerade appen. Offline-läget synkroniserar inte ekonomiska data och ersätter inte säkerhetskopior. Ingen notisfunktion eller bankintegration ingår.

PWA-bygget genererar PNG-appikoner utan extra dependencies och ett versionshanterat service worker-skript med cachade statiska resurser. Manifest, Pages-scope, Apple-ikon och offline-fallback testas vid varje produktionsbygge.

## Firebase (valfritt molnstöd)

Molnlagringen är **avstängd tills Firebase är konfigurerat**. Den fungerar utan någon ChatGPT-plugin. Appens gamla lokala dataformat ändras inte.

Se [Firebase installationsguide](docs/FIREBASE_SETUP.md) för att aktivera e-postinloggning, Firestore-regler och en enda GitHub Actions-variabel. När det är klart kan du ansluta under **Inställningar → Molnlagring**. Första överföringen är alltid ett aktivt val; ingen befintlig budget skrivs över vid inloggning. Vid molnhämtning behålls en lokal säkerhetskopia som kan återställas i appen utan automatisk JSON-nedladdning. Efter anslutning sparas nya ändringar online med revisionskontroll. Offline-konflikter kräver manuell återställning och säkerhetskopia.

## Vad finns?

- **Startsidan visar bara dagens resultat och ett snabbformulär för löpande utgifter.** Belopp krävs, beskrivning är valfri och utgiften bokförs på dagens datum. Dagens resultat inkluderar dagsnettot och registrerade händelser.
- **Utveckling** är en separat meny med dagligt grundnetto, saldo, veckans och månadens resultat, prognos, graf och de senaste händelserna. Återkommande belopp kan vara per vecka, månad, kvartal eller år.
- Registrera rörliga utgifter och extra inkomster i ören, med datum.
- **Månadsvy:** en tabellrad för varje datum med registrerade händelser, dagsresultat och löpande budgetsaldo. Fasta inkomster och kostnader ingår automatiskt i resultatet, men räknas inte upp i tabellen eller dagdetaljerna. Bläddra mellan månader och fäll ut en dag för att se enbart manuellt registrerade händelser.
- Beräknat budgetsaldos utveckling, dags-, vecko-, månadsresultat samt enkel 30-dagarsprognos.
- Återkommande poster får effektiva start- och slutdatum; beloppsändring skapar ny version.
- Lokal lagring samt import och export av JSON-säkerhetskopior.
- Mobilvänligt gränssnitt. Ett personligt konto nu, datafält för flera medlemmar senare.

### Viktig skillnad: webbpublicering och datalagring

**Utan ansluten Firebase** sparas uppgifter bara i webbläsaren. Med Firebase-konfiguration, aktiverad e-postinloggning, skyddade Firestore-regler och en aktiv användarsession kan budgeten lagras online och användas från flera enheter. Lokala kopior finns kvar i webbläsaren och ersätter inte JSON-backup. iPhone-hemskärmsappar kan ha separat lagring från Safari. GitHub innehåller inga privata budgetdata.

**Beräknat budgetsaldo är inte ett bankkontosaldo.** Regelbundna belopp fördelas jämnt per dag. Faktiska löne- och betalningsdatum modelleras inte. Framtidsprognosen förutsätter inga framtida rörliga köp.

Arkitektur och framtida flerpersonsstöd: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

MIT-licens.
