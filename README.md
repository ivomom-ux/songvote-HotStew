# SongVote 🎸 — Setup instructies

SongVote is een webapp waarmee jij en je bandleden nummers kunnen voorstellen en op stemmen.
Alle data wordt opgeslagen in **één gedeeld JSON-bestand** in Dropbox, zodat iedereen altijd de nieuwste lijst ziet.

Je kunt SongVote voor **meerdere bands** gebruiken — elke band krijgt zijn eigen link en eigen Dropbox-bestand.

---

## Wat je nodig hebt

- Een gratis **GitHub** account → [github.com](https://github.com)
- Een **Dropbox** account (je hebt er al één)
- Ongeveer **10 minuten** voor de eerste band, **5 minuten** voor elke volgende

---

## Eerste keer: GitHub account aanmaken

1. Ga naar [github.com/signup](https://github.com/signup)
2. Maak een gratis account aan
3. Bevestig je e-mailadres

Dit doe je maar één keer.

---

## Één band instellen

Volg deze stappen voor elke band. Kies een korte naam zonder spaties, bv. `the-rollingbones` of `jazzband`.

### Stap 1 — Repository aanmaken op GitHub

1. Log in op GitHub
2. Klik rechtsboven op **"+"** → **"New repository"**
3. Geef het de naam: `songvote-BANDNAAM` (bv. `songvote-the-rollingbones`)
4. Zet het op **Public**
5. Vink aan: **"Add a README file"**
6. Klik op **"Create repository"**

### Stap 2 — index.html uploaden

1. Open de nieuwe repository
2. Klik op **"Add file"** → **"Upload files"**
3. Sleep `index.html` naar het uploadvenster
4. Klik op **"Commit changes"**

### Stap 3 — Dropbox App aanmaken

Elke band krijgt zijn eigen Dropbox app (en dus eigen data).

1. Ga naar [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)
2. Klik op **"Create app"**
3. Kies:
   - **Scoped access**
   - **Full Dropbox**
4. Geef de app een naam, bv. `SongVote-the-rollingbones`
5. Klik op **"Create app"**

Je zit nu in het dashboard van je app.

6. Scroll naar **"OAuth 2"** → **"Redirect URIs"**
7. Voeg toe: `https://JOUWGEBRUIKERSNAAM.github.io/songvote-BANDNAAM/`
   *(let op de `/` aan het einde!)*
8. Klik op **"Add"**
9. Kopieer de **"App key"** bovenaan de pagina

### Stap 4 — App Key en bestandsnaam invullen in de code

1. Ga naar je GitHub repository
2. Klik op `index.html` → klik op het **potloodje** (Edit)
3. Zoek en pas deze twee regels aan:
   ```javascript
   const DBX_APP_KEY   = 'JOUW_APP_KEY_HIER';   // ← jouw App key
   const DBX_FILE_PATH = '/songvote_data.json';  // ← geef het een unieke naam per band
   ```
   Bv. voor "The Rolling Bones":
   ```javascript
   const DBX_APP_KEY   = 'abc123xyz456';
   const DBX_FILE_PATH = '/songvote_the-rollingbones.json';
   ```
   > 💡 Door het JSON-bestand een unieke naam te geven kunnen bandleden die bij meerdere bands zitten gewoon hun eigen Dropbox gebruiken zonder dat de data door elkaar loopt.
4. Klik op **"Commit changes"**

### Stap 5 — GitHub Pages inschakelen

1. Ga naar **Settings** in de repository
2. Klik links op **"Pages"**
3. Kies onder "Branch": **main** → **/ (root)**
4. Klik op **"Save"**

Na 1-2 minuten is de app live op:
**`https://JOUWGEBRUIKERSNAAM.github.io/songvote-BANDNAAM/`**

### Stap 6 — Link delen met de band

Stuur de link naar je bandleden. Iedereen:
1. Opent de link
2. Voert hun naam in
3. Klikt op **"Verbind Dropbox"** en logt in met hun eigen Dropbox
4. Klaar — alle stemmen worden automatisch gesynchroniseerd

---

## Meerdere bands: overzicht

Na de eerste keer zijn stap 3, 4 en 5 het enige dat je per band opnieuw doet.

| Band | Repository | App-link | Dropbox-bestand |
|---|---|---|---|
| The Rolling Bones | `songvote-the-rollingbones` | `...github.io/songvote-the-rollingbones/` | `songvote_the-rollingbones.json` |
| Jazzband | `songvote-jazzband` | `...github.io/songvote-jazzband/` | `songvote_jazzband.json` |
| enz. | `songvote-...` | `...github.io/songvote-.../` | `songvote_....json` |

---

## Hoe werkt de synchronisatie?

- Data wordt opgeslagen in één JSON-bestand per band in Dropbox
- Elke wijziging (nummer toevoegen, stemmen, reactie) wordt automatisch opgeslagen
- Bij het openen van de app wordt de nieuwste data ingeladen
- Voor een kleine band (onder 10 mensen) is gelijktijdig gebruik geen probleem in de praktijk

---

## Problemen?

| Probleem | Oplossing |
|---|---|
| "Verbinden mislukt" na Dropbox login | Controleer of de Redirect URI exact overeenkomt met de app-link, inclusief `/` aan het einde |
| Data van verkeerde band zichtbaar | Controleer of `DBX_FILE_PATH` per band een unieke naam heeft |
| Lege lijst na inloggen | Het bestand bestaat nog niet — voeg een eerste nummer toe |
| App niet bereikbaar | Wacht 2 minuten na het inschakelen van GitHub Pages |
| Wijzigingen niet zichtbaar voor anderen | Ververs de pagina — de app laadt bij elke pageload de nieuwste data |
