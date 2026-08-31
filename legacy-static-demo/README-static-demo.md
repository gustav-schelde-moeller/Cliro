# Cliro

Et lead-research- og outreach-værktøj, oprindeligt bygget til DAVAI (reklamefilm/musikvideo-produktionsselskab). "Virksomheder" (forsiden) viser danske virksomheder scoret efter, hvor god en grund der er til at skrive til dem — baseret på research af nyheder, eksisterende reklamer og sociale medier — med et automatisk genereret pitch-udkast pr. virksomhed. Dashboard giver et samlet overblik over, hvilke virksomheder teamet har rørt ved, og hvad der er gjort ved dem (status, tildeling). Team-laget dækker konti, teams, invitationer, en ejer/admin/medlem-rollehierarki og en aktivitetslog.

Det er én selvstændig HTML-fil (`index.html`) — ingen build-step, ingen server-krav for at kigge på den. Alt HTML/CSS/JS ligger i filen.

## Kør det lokalt

Åbn filen direkte i en browser:

```bash
open index.html   # macOS
# eller: start index.html   (Windows)
# eller: xdg-open index.html  (Linux)
```

Eller kør en lille lokal server (undgår nogle browsere, der er strenge med `file://`):

```bash
npx serve .
# eller
python3 -m http.server 8000
```

## Konti, teams og hvor data bor

Der er ingen backend — alt gemmes i browserens `localStorage`, med et in-memory fallback hvis browseren blokerer det (se nedenfor):

- **Konti** oprettes med navn + email + adgangskode ("Opret konto"), eller du kan logge ind med en eksisterende konto. "Glemt adgangskode?" på login-siden lader dig sætte en ny adgangskode med det samme (ingen mail sendes — der er ingen server til det). Dette er **ikke rigtig sikkerhed** (ingen server, ingen kryptering af adgangskoden) — brug ikke en adgangskode, du bruger andre steder. "Fortsæt med Google" er bevidst ikke funktionel (se afsnit nedenfor).
- **Teams** opretter du selv efter login — den, der opretter teamet, bliver **ejer** (vises med et gult "Ejer"-badge) og har altid admin-rettigheder. Ejeren er den eneste, der kan gøre andre til admin eller tilbage til medlem. Alle admins (inkl. ejeren) kan tilføje og fjerne medlemmer; almindelige medlemmer kan kun arbejde med leads (status, tildeling, mail) — de kan ikke invitere eller fjerne nogen. Et team har en 6-tegns invitationskode, som deles som kode, som link (`?join=KODE`, der forudfylder feltet), eller via en mail-kladde (åbner dit eget mailprogram — appen sender ikke selv mails). Et fjernet medlems session bliver spærret ude, selv hvis de stadig er "logget ind" i deres egen browser.
- **Status, tildeling, aktivitetslog og teammedlemmer** er fuldt skrivbare og delt mellem faner i **samme browser** — men **ikke** mellem forskellige computere/browsere, og en invitationskode virker kun, hvis teamet blev oprettet i den samme browser. Der er stadig ingen rigtig server bag det.
- Hvis browseren blokerer `localStorage` helt (fx filen åbnet direkte som `file://`, eller et strengt privat vindue), falder appen automatisk tilbage til en in-memory-lagring — alt virker stadig i den session, men forsvinder ved genindlæsning. En banner gør opmærksom på det og anbefaler at køre en lokal server i stedet (se "Kør det lokalt" ovenfor).
- **Stjernemarkeringer** og **profilbillede** gemmes også lokalt (profilbilledet nedskaleres til et lille kvadrat, før det gemmes).

Vil I have alt dette delt *på tværs af computere* (ikke kun én browser), kræver det en rigtig backend — se afsnittet nedenfor.

## "Fortsæt med Google"

Knappen er der, men er bevidst ikke funktionel endnu. Et rigtigt Google-login kræver en registreret OAuth-klient hos Google og en backend, der kan validere tokens — det kunne ikke bygges i den sandkasse, appen oprindeligt blev lavet i. Klik på knappen viser en forklarende note i stedet for at foregive et login, der ikke sker noget ved.

## Hvis I vil bygge en rigtig version herfra i Claude Code

Det nuværende login/team-lag er en lokal, per-browser illusion af en rigtig multi-bruger-app — fungerer fint til demo og til at teste flowet alene eller på én delt maskine, men ikke til et rigtigt distribueret team. Vil I have en rigtig, selvstændig version (delt på tværs af hele teamet, egen server, egen database, rigtigt login og rigtige invitations-mails), er den naturlige vej i Claude Code noget i stil med:

1. **Ramme:** Next.js (eller et andet fullstack-framework) — flyt UI'et fra denne fil ind i komponenter, og lad backend'en (API routes) håndtere data.
2. **Database:** Postgres/SQLite/Supabase til at gemme brugere, teams, virksomheder, status, tildelinger og aktivitetslog i stedet for `localStorage`.
3. **Rigtigt login:** [NextAuth.js](https://authjs.dev/) (eller Clerk/Auth0) med email/password og Google som providers — det er her "Fortsæt med Google" og en rigtig "glemt adgangskode"-mail (med et engangslink) bliver reelt, og adgangskoder bliver rigtigt hashet.
4. **Rigtige invitationer:** en mail-tjeneste (Resend, Postmark, SES) til at sende invitationsmails med et link, der rent faktisk virker for modtageren, uanset hvilken computer de sidder ved.
5. **Teams/roller:** en `users`/`teams`/`team_members`-tabel med rolle-felt (owner/admin/member) i stedet for den nuværende `teams`-struktur i `localStorage`.
6. **CVR/kontaktdata:** hvis I vil skalere ud over virksomhederne i denne fil, kræver det enten officiel CVR-bulkadgang fra Erhvervsstyrelsen eller en betalt plan hos en CVR-udbyder (fx virkdata.dk) — jeres nuværende nøgle er kun til enkeltopslag på Free-planen (20 opslag/dag).
7. **Løbende leadresearch:** "Indlæs flere"-knappen viser i dag et fast, håndresearchet datasæt. En rigtig, uendelig strøm af nye leads (baseret på løbende nyheds-/social media-søgning) kræver en baggrundsjob, der periodisk researcher og gemmer nye virksomheder — det kan ikke køre fra en statisk HTML-fil i browseren alene.

Al scoring-logik, den researchede virksomhedsdata, mail-skabelonerne og UI'et i denne fil kan direkte genbruges som udgangspunkt — det er primært "gem"-laget (`mutateState` / `loadState` / `saveState` / konto- og team-funktionerne i `index.html`) og login-siden, der skal skiftes ud med rigtige API-kald.

## Data

Virksomhederne i `COMPANIES`-arrayet i `index.html` er et demo-datasæt fra august 2026 — rigtige, researchede virksomheder med kildehenvisninger i UI'et (klik en virksomhed → "Læs kilden"), men det er ikke en fuld liste over danske virksomheder. Koordinater brugt til afstandsfilteret er by-niveau (hovedkontorets by), ikke præcise adresser. "Indlæs flere" bladrer gennem hele dette datasæt.

## Struktur

```
davai-leads-project/
├── index.html   ← hele appen (HTML + CSS + JS)
└── README.md    ← denne fil
```
