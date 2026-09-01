# Cliro

Lead-research og outreach for jeres team. Bygget med Next.js, en rigtig PostgreSQL-database, rigtig autentifikation (email/password + valgfri Google-login) og rigtig email-afsendelse.

Appen er 100% færdigbygget og testet — signup/login, multi-team med roller (ejer/admin/medlem), invitationer, lead-tildeling, aktivitetslog, avatar-upload, glemt kodeord, det hele virker mod en rigtig database. Der er **4 ting du selv skal gøre** for at få den i luften, fordi de kræver dine egne konti. Alt andet er allerede gjort.

## Oversigt

1. [Database (Neon)](#1-database-neon) — 5 min, gratis
2. [Email (Resend)](#2-email-resend) — 5 min, gratis, valgfrit men anbefalet
3. [Hosting (GitHub + Vercel)](#3-hosting-github--vercel) — 10 min, gratis
4. [Google-login](#4-google-login-valgfrit) — 10 min, helt valgfrit

---

## 1. Database (Neon)

Appen bruger PostgreSQL. [Neon](https://neon.tech) har en gratis plan der er rigelig til at starte med.

1. Gå til [neon.tech](https://neon.tech) og opret en konto (kan bruge GitHub-login).
2. Opret et nyt projekt — kald det fx `cliro`.
3. Når projektet er oprettet, find **Connection string** (den ligner `postgresql://bruger:kode@host/database?sslmode=require`). Kopiér den.
4. Åbn `.env` i projektet og sæt:
   ```
   DATABASE_URL="<den connection string du kopierede>"
   ```
5. Kør denne kommando fra projektmappen for at oprette alle tabeller i din nye database:
   ```bash
   npx prisma db push
   ```
   Du bør se `Your database is now in sync with your Prisma schema.` Det var det — databasen er klar.

Gem connection stringen et sted — du skal bruge den igen i trin 3.

## 2. Email (Resend)

Bruges til invitations-mails og "glemt kodeord"-mails. **Uden dette virker appen stadig fint** — den viser bare en tydelig fejlbesked i stedet for at sende mailen, så du kan altid tilføje det senere.

1. Gå til [resend.com](https://resend.com) og opret en konto.
2. Under **API Keys**, opret en ny nøgle. Kopiér den (starter med `re_`).
3. Sæt i `.env`:
   ```
   RESEND_API_KEY="re_..."
   EMAIL_FROM="Cliro <onboarding@resend.dev>"
   ```
   `onboarding@resend.dev` er Resends indbyggede test-afsender — den virker med det samme, men Resend tillader kun at sende **til den emailadresse du selv har oprettet Resend-kontoen med**, indtil du verificerer et rigtigt domæne.
4. **Valgfrit — for at sende til alle:** Under **Domains** i Resend, tilføj jeres eget domæne (fx `davaidavai.dk`) og følg deres DNS-instruktioner (nogle DNS-records skal tilføjes hos jeres domæne-udbyder). Når domænet er verificeret, skift `EMAIL_FROM` til fx `"Cliro <noreply@davaidavai.dk>"`.

## 3. Hosting (GitHub + Vercel)

### 3a. Læg koden på GitHub

1. Gå til [github.com](https://github.com) og opret en konto, hvis du ikke har en.
2. Opret et nyt, **tomt** repository (uden README/gitignore — det har vi allerede) — kald det fx `cliro`.
3. GitHub viser dig en remote-URL, typisk `https://github.com/dit-brugernavn/cliro.git`. Kør disse kommandoer fra projektmappen:
   ```bash
   git remote add origin https://github.com/dit-brugernavn/cliro.git
   git branch -M main
   git push -u origin main
   ```
   (Git kan bede dig logge ind første gang — følg instruktionerne i terminalen.)

### 3b. Deploy på Vercel

1. Gå til [vercel.com](https://vercel.com) og opret en konto med **"Continue with GitHub"** — så er de to allerede forbundet.
2. Klik **Add New → Project**, og vælg dit `cliro`-repository.
3. Under **Environment Variables**, tilføj disse (samme værdier som i din lokale `.env`):

   | Navn | Værdi |
   |---|---|
   | `DATABASE_URL` | connection string fra Neon (trin 1) |
   | `AUTH_SECRET` | en tilfældig lang streng — kør `openssl rand -base64 32` i terminalen for at generere en |
   | `NEXTAUTH_URL` | din kommende Vercel-URL, fx `https://cliro.vercel.app` (du kan rette den efter første deploy hvis navnet bliver anderledes) |
   | `RESEND_API_KEY` | fra trin 2 (valgfrit) |
   | `EMAIL_FROM` | fra trin 2 (valgfrit) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | fra trin 4 (valgfrit) |

4. Klik **Deploy**. Efter et par minutter er appen live på jeres `.vercel.app`-adresse.
5. Hvis du rettede `NEXTAUTH_URL` efter deploy (fordi Vercel gav jer et andet navn end forventet), opdatér variablen under **Settings → Environment Variables** og klik **Redeploy**.

Det er det — appen er nu i luften med en rigtig database, rigtig login og (hvis I satte trin 2 op) rigtig email.

## 4. Google-login (valgfrit)

Uden dette virker email/password-login stadig 100%. "Fortsæt med Google"-knappen viser bare en note om at den ikke er sat op endnu.

1. Gå til [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Opret et projekt (eller brug et eksisterende), og opret et **OAuth 2.0 Client ID** af typen "Web application".
3. Under **Authorized redirect URIs**, tilføj:
   ```
   https://jeres-app.vercel.app/api/auth/callback/google
   ```
   (brug jeres rigtige Vercel-URL).
4. Kopiér **Client ID** og **Client secret**, og sæt dem som `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` i Vercels environment variables (og redeploy).

---

## 5. Daglig research (Anthropic API, valgfrit)

Uden dette virker appen 100% fint — virksomhedslisten vokser bare ikke af sig selv. Med det sat op, søger et automatisk job på nettet efter op til 5 nye danske virksomheder med en ægte nyhed offentliggjort samme dag ad gangen, og tilføjer dem til listen (eksisterende virksomheder bliver aldrig rettet eller slettet). Det kører 4 gange hver hverdag (kl. 06, 08, 10 og 12 UTC) — opdelt i flere mindre kørsler, fordi Vercels gratis Hobby-plan sætter en hård grænse på 300 sekunder pr. kørsel, og en fuld same-day-søgning på ret mange virksomheder på én gang ikke kan nå at blive færdig inden for det. Samlet giver det stadig op til ca. 20/dag. Kører ikke i weekenden. Bruger Claude Sonnet — koster groft anslået 50-110 kr/dag ved fuld volumen, typisk mindre på stille nyhedsdage.

Selve tidsstyringen sker via en **GitHub Actions-workflow** ([.github/workflows/daily-research.yml](.github/workflows/daily-research.yml)) i stedet for Vercels indbyggede Cron Jobs — Vercels gratis plan afviste et cron-skema med mere end én kørsel om dagen, mens GitHub Actions ikke har den begrænsning.

1. Gå til [console.anthropic.com](https://console.anthropic.com), opret en API-nøgle under et konkret Workspace (ikke en personligt bundet nøgle), og læg penge på kontoen.
2. Sæt nøglen som `ANTHROPIC_API_KEY` i Vercels environment variables, og redeploy.
3. Generér en tilfældig hemmelighed:
   ```bash
   openssl rand -base64 32
   ```
   Sæt værdien som `CRON_SECRET` i Vercels environment variables (redeploy igen).
4. Tilføj **samme** værdi som en **GitHub Actions secret** i repoet: **Settings → Secrets and variables → Actions → New repository secret**, navngiv den `CRON_SECRET`, og indsæt værdien.
5. Det var det — workflow'en kører automatisk efter sin tidsplan. Den kan også køres manuelt til test via **Actions**-fanen → **Daily company research** → **Run workflow**.

I "Virksomheder"-visningen kan man sortere efter "Nyeste tilføjet" og filtrere til "Nye i dag" for hurtigt at se, hvad der er kommet ind — kortet på hver virksomhed viser også et "Ny"-mærke, når nyheden er fra i dag.

---

## Lokal udvikling

```bash
npm install
npx prisma db push   # kun første gang, eller efter ændringer i prisma/schema.prisma
npm run dev
```

Kræver en `DATABASE_URL` i `.env` der peger på en rigtig Postgres-database (samme Neon-database som produktion virker fint til lokal udvikling).

## Teknisk

- **Next.js 16** (App Router, Server Actions) + **React 19**
- **Prisma 6** mod **PostgreSQL**
- **Auth.js v5** (email/password via bcrypt + valgfri Google OAuth), JWT-sessions
- **Resend** til transaktionel email, med indbygget graceful fallback når den ikke er sat op
- Alle sider under `(app)/` er server-renderet og tjekker rigtig database-adgang ved hvert kald — fjernes et medlem fra et team, mister de adgangen med det samme, uanset hvad der står i deres cookie
- Virksomheder ligger i en rigtig `Company`-tabel (ikke en statisk fil), så `/api/cron/daily-research` kan tilføje nye rækker hver dag uden at redeploye
