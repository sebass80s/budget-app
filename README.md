# Budget App

En personlig budget inspirerad av [Civilization-budgetering](https://archive.alexrecker.com/civ-budget.html): **ett dagligt grundnetto, en händelse i taget**.

## Starta

Kräver Node.js 22 eller senare.

```bash
npm install
npm run dev
```

Öppna http://localhost:3000. Första gången ser du tydligt markerade **demodata**. Klicka på **Börja med min budget** för att tömma demot.

```bash
npm test
npm run typecheck
npm run build
```

GitHub Actions kör `npm run verify` på varje pull request och på `main`.

## Vad finns?

- Dagsnetto beräknat från återkommande inkomster och fasta utgifter: per vecka, månad, kvartal eller år.
- Registrera rörliga utgifter och extra inkomster i ören, med datum.
- Beräknat budgetsaldos utveckling, dags-, vecko-, månadsresultat samt enkel 30-dagarsprognos.
- Återkommande poster får effektiva start- och slutdatum; beloppsändring skapar ny version.
- Lokal lagring samt import och export av JSON-säkerhetskopior.
- Mobilvänligt gränssnitt. Ett personligt konto nu, datafält för flera medlemmar senare.

### Observera

**Beräknat budgetsaldo är inte ett bankkontosaldo.** Regelbundna belopp fördelas jämnt per dag i denna modell. Faktiska löne- och betalningsdatum modelleras inte. Framtidsprognosen förutsätter inga framtida rörliga köp.

**Ingen serverinloggning eller synkronisering ännu:** Budgetuppgifter finns bara i din webbläsares `localStorage`, okrypterat. Rensa inte webbläsardata utan säkerhetskopia och undvik delade enheter med verkliga uppgifter. GitHub innehåller inga användaruppgifter.

Arkitektur och framtida flerpersonsstöd: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

MIT-licens.
