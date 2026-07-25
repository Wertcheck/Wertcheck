# WertCheck Backend

KI-Agenten Backend für die automatische Immobilienbewertung.

## Agenten

| Agent | Aufgabe |
|-------|---------|
| **Jonas** | Koordinator — verteilt Aufgaben |
| **Clara** | Erstellt Bewertungstext per Claude API |
| **Tim** | Generiert das PDF |
| **Elena** | Versendet E-Mails an Kunde + intern |

## Setup auf Render.com

### 1. GitHub Repository erstellen
- Neues Repository auf github.com erstellen
- Alle Dateien hochladen

### 2. Render verbinden
- render.com → "New Web Service"
- GitHub Repository verbinden
- Build Command: `npm install`
- Start Command: `npm start`

### 3. Environment Variables bei Render eintragen
Unter "Environment" folgende Variablen eintragen:

```
ANTHROPIC_API_KEY    = sk-ant-...
SMTP_USER_1          = Wertermittlung1@outlook.de
SMTP_PASS_1          = [App-Kennwort 1]
SMTP_USER_2          = Wertermittlung2@outlook.de
SMTP_PASS_2          = [App-Kennwort 2]
INTERN_EMAIL         = Datenchecker@outlook.de
```

### 4. Website URL aktualisieren
In der index.html die URL anpassen:
```
fetch('https://DEINE-RENDER-URL.onrender.com/bewertung', ...)
```

## Ablauf

```
Kunde → Website Wizard → Render Backend
                              ↓
                           Jonas
                          /  |  \
                       Clara Tim Elena
                          \  |  /
                        E-Mail + PDF
                        an Kunden
```
