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

- Öppna appen → **Inställningar → Molnlagring**.
- Skapa ett e-postkonto eller logga in.
- Om molnet är tomt: avsluta först demot, välj sedan **Lägg min budget i molnet**.
- Om molnet redan innehåller en budget: välj **Hämta molnbudget**. En JSON-säkerhetskopia av den lokala budgeten laddas ned före ersättningen.
- När budgeten är ansluten sparas nya ändringar automatiskt **vid internetuppkoppling**. Vid konflikt stoppas vidare uppladdning, så en äldre enhet inte tyst ska skriva över en nyare kopia.
- På ytterligare enheter: logga in med samma konto och välj att hämta molnbudgeten. Installerade PWA-appar och Safari kan ha separata lokala lagringsutrymmen.

## Begränsningar

Synkroniseringen kräver internet. Den befintliga lokala budgeten och PWA:s offlinefunktion finns kvar, men **offlineändringar går inte att sammanfoga automatiskt**; använd export/import för säker återställning. Den här första Firestore-versionen lagrar budgeten som ett versionshanterat dokument med storleksgräns runt 790 KB. CI testar koden, inte live-reglerna. Verifiera inloggning, att reglerna skyddar data och två enheters synkronisering innan du förlitar dig på molnet.
