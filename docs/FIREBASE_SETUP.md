# Firebase setup (utan ChatGPT-plugin)

Budget App körs fortfarande på GitHub Pages. Molnkopplingen är frivillig och är avstängd tills nedanstående inställningar är klara. Appen kan användas lokalt under tiden.

## 1. Slå på e-postinloggning

Öppna https://console.firebase.google.com/ och välj ditt befintliga budget-app-projekt.

- Öppna **Build → Authentication → Get started → Sign-in method**.
- Välj **Email/Password** och aktivera. Vi behöver ingen Google-popup, redirect eller egen server.
- Under **Authentication → Settings → Authorized domains**, lägg till `sebass80s.github.io` om domänen saknas.

## 2. Aktivera Firestore och publicera säkerhetsreglerna

- Öppna **Build → Firestore Database → Create database** och skapa standarddatabasen i produktionsläge.
- Öppna Firestore-fliken **Rules**. Ersätt innehållet med filen [firestore.rules](../firestore.rules) från GitHub-repot och klicka **Publish**.
- Reglerna begränsar varje användare till `users/{uid}/budgets/main` och tillåter inte anonyma läsningar eller skrivningar. Publicera reglerna innan appens molnläge används.
- Använd aldrig `allow read, write: if true` för denna ekonomiska data.

## 3. Koppla in webbappens publika Firebase-konfiguration

- Öppna **Project settings → General → Your apps → Add app → Web** och registrera en webbapp med valfritt namn, t.ex. `budget-app`. Firebase Hosting behövs inte.
- Kopiera objektet `firebaseConfig` med fälten `apiKey`, `authDomain`, `projectId`, `appId` samt eventuellt `messagingSenderId`.
- Öppna [GitHub Actions variables](https://github.com/sebass80s/budget-app/settings/variables/actions). Skapa **en Repository variable** med namnet `FIREBASE_CONFIG_JSON`.
- Klistra in innehållet som **giltig JSON**, alltså citerade nycklar, inte en `const firebaseConfig =`-rad. Exempel:

```json
{
  "apiKey": "PUBLIC_FIREBASE_WEB_API_KEY",
  "authDomain": "YOUR_PROJECT.firebaseapp.com",
  "projectId": "YOUR_PROJECT",
  "appId": "YOUR_WEB_APP_ID",
  "messagingSenderId": "123456789"
}
```

- Firebase webbkonfiguration innehåller offentliga identifierare, inte service-account-hemligheter. Lägg **aldrig** in en privat nyckel, Admin SDK JSON eller service_role här.
- Om du redigerar `FIREBASE_CONFIG_JSON` (till exempel för att rätta ett felstavat API-key-tecken) måste GitHub Pages **publiceras på nytt**. Det räcker inte att bara spara variabeln. Kör [Deploy to GitHub Pages](https://github.com/sebass80s/budget-app/actions/workflows/deploy-pages.yml) manuellt på `main`, eller invänta nästa publicering. Vid bygget genereras `public/firebase-config.json` och publiceras som en del av den statiska appen. Denna konfiguration undantas från PWA:s offline-cache för att undvika gamla inställningar. Om den installerade appen ändå visar lokal-only efter första bytet, stäng och öppna appen igen efter uppdateringen.

## 4. Använd

- Budget App kräver inloggning och aktiv internetanslutning. Ingen demoversion, lokal budgetlagring eller separat synkknapp.
- Ett nytt konto får en tom budget i Firestore. Befintliga konton läser sin budget från Firebase vid inloggning.
- Alla ändringar sker via **Firestore-transaktioner** på den senaste versionen av budgeten. Appen uppdaterar sina siffror först efter bekräftad serverlagring.
- Den andra enheten får ändringar automatiskt via en live-lyssnare till Firestore. Ingen manuell "hämta budget" behövs.
- Vid avbrott/nekad lagring visas ett fel. Ingen osynkroniserad lokal budget skapas eller används som backup.
- JSON-export och -import finns kvar som manuella verktyg för säkerhetskopiering; en import skrivs till Firebase först efter bekräftelse.
- **Migrering:** äldre värden under webbläsarens `budget-app:v1` och eventuella lokala backupnycklar lämnas orörda men läses inte längre som budget. Om äldre data behöver återställas krävs manuell recovery, inte automatisk överskrivning.

## Begränsningar

Internet behövs för att använda budgeten och registrera händelser. PWA-skalet kan finnas offline men budgetdata visas inte utan kontakt med Firebase. Firebase Authentication kan behålla inloggningssessionen i sin egen lagring. Den här första Firestore-versionen lagrar budgeten som ett versionshanterat dokument med storleksgräns runt 790 KB. CI testar koden, inte Firebase-reglerna mot ett riktigt konto.
