# SongVote 🎸 — Setup instructies

SongVote is een webapp waarmee jij en je bandleden nummers kunnen voorstellen en op stemmen.
Data wordt opgeslagen als een JSON-bestand in je GitHub repository — **bandleden hoeven nergens op in te loggen**, ze openen gewoon de link.

---

## Hoe het werkt

- `songvote_data.json` staat in je GitHub repository
- De app **leest** dit bestand direct via de publieke GitHub URL (geen login nodig)
- De app **schrijft** via de GitHub API met een token dat jij instelt — dit staat veilig in de code, alleen jij ziet het
- Bandleden openen gewoon de link en stemmen meteen

---

## Wat je nodig hebt

- Een gratis **GitHub** account → [github.com](https://github.com)
- Ongeveer **15 minuten** voor de eerste keer

---

## Eenmalige setup: GitHub account aanmaken

1. Ga naar [github.com/signup](https://github.com/signup)
2. Maak een gratis account aan en bevestig je e-mailadres

---

## Één band instellen

### Stap 1 — Repository aanmaken

1. Log in op GitHub
2. Klik rechtsboven op **"+"** → **"New repository"**
3. Naam: `songvote-BANDNAAM` (bv. `songvote-hotstew`)
4. Zet op **Public**
5. Vink aan: **"Add a README file"**
6. Klik op **"Create repository"**

---

### Stap 2 — Bestanden uploaden

Upload de volgende bestanden naar je repository via **"Add file" → "Upload files"**:

- `index.html` — de app
- `songvote_data.json` — de data (begin met een leeg bestand: `[]`)

Voor het mapje `.github/workflows/` (GitHub Action):
1. Klik op **"Add file" → "Create new file"**
2. Typ als bestandsnaam: `.github/workflows/save-data.yml`
3. Kopieer de inhoud van `save-data.yml` uit de zip en plak het in het tekstveld
4. Klik op **"Commit changes"**

---

### Stap 3 — Personal Access Token aanmaken

Dit is het "sleuteltje" waarmee de app data kan opslaan.

1. Ga naar [github.com/settings/tokens](https://github.com/settings/tokens)
2. Klik op **"Generate new token (classic)"**
3. Geef het een naam: `SongVote`
4. Stel de vervaldatum in op **"No expiration"** (of een jaar)
5. Vink aan: **`repo`** (de hele sectie)
6. Klik op **"Generate token"**
7. **Kopieer de token meteen** — je ziet hem maar één keer!

---

### Stap 4 — Token en config invullen in index.html

1. Ga naar je repository op GitHub
2. Klik op `index.html` → klik op het **potloodje** (Edit)
3. Zoek bovenaan het script-blok deze regels:

```javascript
const GH_OWNER      = 'JOUW_GITHUB_GEBRUIKERSNAAM';
const GH_REPO       = 'JOUW_REPOSITORY_NAAM';
const GH_TOKEN      = 'JOUW_GITHUB_TOKEN';
const GH_DATA_FILE  = 'songvote_data.json';
const ADMIN_USER    = 'Jan';
```

4. Vul in:
   - `GH_OWNER` → jouw GitHub gebruikersnaam (bv. `'jandevries'`)
   - `GH_REPO` → naam van de repository (bv. `'songvote-hotstew'`)
   - `GH_TOKEN` → de token die je zojuist hebt gekopieerd
   - `ADMIN_USER` → jouw naam zoals je die in de app invult (voor import/export)

5. Klik op **"Commit changes"**

---

### Stap 5 — GitHub Pages inschakelen

1. Ga naar **Settings** in je repository
2. Klik links op **"Pages"**
3. Kies onder "Branch": **main** → **/ (root)**
4. Klik op **"Save"**

Na 1-2 minuten is de app live op:
**`https://JOUWGEBRUIKERSNAAM.github.io/songvote-BANDNAAM/`**

---

### Stap 6 — Link delen

Stuur de link naar je bandleden. Ze openen hem, voeren hun naam in en kunnen meteen stemmen. Geen account, geen login.

---

## Meerdere bands

Per band herhaal je stap 1 t/m 5 met een andere repository naam. De token kun je hergebruiken.

| Band | Repository | Link |
|---|---|---|
| HotStew | `songvote-hotstew` | `...github.io/songvote-hotstew/` |
| Jazzband | `songvote-jazzband` | `...github.io/songvote-jazzband/` |

---

## Data inzien of aanpassen

Het bestand `songvote_data.json` staat gewoon zichtbaar in je repository. Je kunt het daar altijd openen, bekijken en handmatig aanpassen. Elke opslag vanuit de app verschijnt als een commit in de geschiedenis — zo kun je altijd terugkijken of terugdraaien.

---

## Problemen?

| Probleem | Oplossing |
|---|---|
| Lege lijst bij openen | Controleer of `songvote_data.json` bestaat in de repo (inhoud: `[]`) |
| "Opslaan mislukt" | Controleer of `GH_TOKEN` correct is ingevuld en `repo`-rechten heeft |
| App niet bereikbaar | Wacht 2 minuten na het inschakelen van GitHub Pages |
| Wijzigingen niet zichtbaar voor anderen | Ververs de pagina — bij elke pageload wordt de nieuwste data geladen |
| Token verlopen | Maak een nieuw token aan via github.com/settings/tokens en vul hem in |
