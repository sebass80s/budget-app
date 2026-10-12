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

**Viktigt:** Budgetdata finns enbart i Firebase och kräver internet. PWA:n kan installeras på iPhone men budgeten kan inte ändras offline. Firebase hanterar fortsatt inloggningssession. Manuell export av JSON-backup finns i Inställningar. Ingen notisfunktion eller bankintegration ingår.

PWA-bygget genererar PNG-appikoner utan extra dependencies och ett versionshanterat service worker-skript med cachade statiska resurser. Manifest, Pages-scope, Apple-ikon och offline-fallback testas vid varje produktionsbygge.

## Firebase och inloggning

Appen öppnar direkt med inloggning. **Firebase är den enda källan för budgetdata**. Det finns inga parallella lokala budgetkopior och ingen demoversion. Ett nytt konto får en tom budget i Firestore. Befintliga konton läser sin budget från Firebase och får uppdateringar från andra enheter automatiskt.

En registrerad utgift syns först när Firestore-transaktionen har slutförts. Utan internet kan man inte ändra budgeten. Gamla eventuella `localStorage`-budgetar lämnas orörda, men används inte längre. Manuell JSON-export och -import finns kvar som säkerhetskopieringsverktyg.

Se [Firebase installationsguide](docs/FIREBASE_SETUP.md) för inställningar.

## Onboarding för nya konton

En helt ny Firebase-budget märks med `onboarding: { version: 1, completed: false }`. Äldre konton saknar denna markör och får **inte** onboarding automatiskt, även om de är tomma.

Efter inloggning visas fyra korta steg: **Välkommen → Månadsinkomst → Fasta kostnader → Lägg till första utgiften**. Inkomst och fasta kostnader sparas direkt i Firestore som vanliga återkommande månadsbelopp. Flera kostnader kan läggas till. Båda stegen kan hoppas över och uppgifterna kan ändras senare under Inställningar.

När guiden slutförs eller hoppas över markeras den färdig i Firebase. Den visas inte igen efter omladdning eller på andra enheter. Guiden kan öppnas manuellt under **Inställningar → Fler inställningar → Visa introduktionen**, utan att befintlig budget raderas eller skapar en ny. En avbruten onboarding kan återupptas efter omladdning med redan sparade poster intakta.

## Mobilvy

På telefon ryms alla tre menyval på en rad eller radbryts inom sina respektive fält. **Dagens utgifter** och **+ Ny utgift** ska aldrig orsaka horisontell sidscroll, inte heller när belopp eller utgiftsbeskrivningar är långa. Redigeringsfält och åtgärdsknappar anpassas till smala skärmar. **Månadsvy** visar fullbredda dagkort på mobil utan horisontell scroll. Alla belopp och redigeringsmöjligheter är kvar. På dator visas den vanliga tabellen.

## Enkelt användarflöde

**Startsidan:** Dagens utgifter öppnas automatiskt efter inloggning. En tydlig **+ Ny utgift**-knapp öppnar ett enkelt formulär med belopp, valfri beskrivning och datum förvalt till idag. Utgiften syns först när Firebase bekräftat sparningen.

**Menyn har exakt tre val:**

- **Månadsvy:** Se dagen och månaden, med registrerade utgifter, dagsresultat och beräknat budgetsaldo. Nedåtpilen sitter direkt intill datumet. Öppna en dag för att lägga till eller **ändra en tidigare utgift** utan att lämna månadsvyn.
- **Dagens utgifter:** Dagens lista och totalsumma. Tryck **Ändra** på en post för att rätta belopp, beskrivning eller datum direkt i listan, eller ta bort en felregistrering.
- **Inställningar:** Lägg till och hantera **inkomster** och **fasta kostnader** (nya poster anges per månad). Tidigare sparade intervall behålls. Fler inställningar innehåller startsaldo, JSON-säkerhetskopia, konto och avancerade åtgärder.

En tydlig **+ Ny utgift**-knapp och den klickbara logotypen tar alltid tillbaka användaren till den snabba registreringen. Datum är förvalt till idag och kan ändras under **Ändra datum**. Ovanför formuläret visas dagens resultat, eller resultatet för valt datum om användaren registrerar en äldre utgift. Resultatet beräknas från fasta inkomster och kostnader samt registrerade händelser och uppdateras efter bekräftad Firebase-sparning. Små knappar har större tryckytor på mobil, och bara relevant feedback visas vid sparning. Dagens utgifter uppdateras när en PWA öppnas efter midnatt. Budgetdata lagras endast i Firebase. När en utgift redigeras uppdateras den befintliga posten i en Firestore-transaktion, utan att en dubblett skapas. Om en annan enhet har ändrat just den utgiften under tiden stoppar appen en överskrivning.

### Datalagring

Budgetdata finns i den inloggade användarens Firestore-dokument med säkerhetsregler per konto. Alla ändringar skrivs via transaktioner direkt mot servern. GitHub innehåller inga privata budgetdata.

**Beräknat budgetsaldo är inte ett bankkontosaldo.** Regelbundna belopp fördelas jämnt per dag. Faktiska löne- och betalningsdatum modelleras inte. Framtidsprognosen förutsätter inga framtida rörliga köp.

Arkitektur och framtida flerpersonsstöd: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

MIT-licens.
