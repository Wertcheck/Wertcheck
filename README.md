# ImmoWertChecker Backend

KI-Agenten-Team für die automatische Immobilienbewertung, inkl. E-Mail-Verifizierung.

## Struktur

```
server.js              ← Einstiegspunkt: Express-Server + Endpunkte
agents/
  jonas.js              ← Koordinator: nimmt Wizard-Daten entgegen, steuert den Ablauf
  clara.js              ← Immobilienanalystin: berechnet den Wert, schreibt die Analyse (Claude API)
  tim.js                ← Dokumenten-Spezialist: erstellt das PDF
  elena.js              ← Kundenkommunikation: verschickt E-Mails (SendGrid API)
  verification.js        ← Hilfsmodul: Bestätigungscodes erzeugen/prüfen
```

## Das Team

| Agent | Rolle | Aufgabe |
|-------|-------|---------|
| **Jonas** | Koordinator | Vereinheitlicht die Wizard-Daten, reicht sie durchs Team, fängt Fehler ab |
| **Clara** | Immobilienanalystin | Berechnet den Marktwert und schreibt die verständliche Einschätzung (via Claude API) |
| **Tim** | Dokumenten-Spezialist | Baut daraus das fertige, gebrandete PDF |
| **Elena** | Kundenkommunikation | Versendet den Bestätigungscode, die E-Mail an den Kunden (mit PDF) und die interne Benachrichtigung — über die SendGrid API |

## Ablauf (inkl. E-Mail-Bestätigung)

```
Kunde füllt Wizard aus → gibt E-Mail ein
        ↓
POST /send-code           → Elena verschickt 6-stelligen Code
        ↓
Kunde gibt Code im Wizard ein
        ↓
POST /verify-code         → Code wird geprüft
        ↓ (nur bei Erfolg)
POST /bewertung           → Jonas → Clara → Tim → Elena
                             (Marktwert, PDF, Versand an Kunde + intern)
```

Die `/bewertung`-Route prüft server-seitig zusätzlich, ob die E-Mail
tatsächlich verifiziert wurde — nicht nur, dass das Frontend das
suggeriert. Ohne gültige, noch nicht abgelaufene Verifizierung wird
die Anfrage mit Status 403 abgelehnt.

## Setup auf Render.com

### 1. GitHub Repository
Alle Dateien hochladen — **inklusive dem `agents/`-Ordner mit allen fünf Dateien**:
```
server.js
package.json
agents/jonas.js
agents/clara.js
agents/tim.js
agents/elena.js
agents/verification.js
index.html   (die Website selbst)
```

### 2. Render verbinden
- render.com → "New Web Service"
- GitHub Repository verbinden
- Build Command: `npm install`
- Start Command: `npm start`

### 3. Environment Variables bei Render eintragen

Siehe `.env.example`:

```
ANTHROPIC_API_KEY   = sk-ant-...
SENDGRID_API_KEY    = SG....
SENDER_EMAIL        = bewertung@immowertchecker.de
REPLY_TO_EMAIL      = info@immowertchecker.de
INTERN_EMAIL        = Datenchecker@outlook.de
```

**Wichtig:** `SENDER_EMAIL` muss bei SendGrid unter **Sender
Authentication** verifiziert sein (bei euch bereits durch die
Domain-Authentifizierung automatisch erledigt).

### 4. Website-URL prüfen

Da `server.js` die `index.html` gleich selbst mit ausliefert (`express.static`),
muss jeder `fetch(...)`-Aufruf im Wizard (`/send-code`, `/verify-code`,
`/bewertung`) auf genau diese Render-URL zeigen.

## Testen

1. Wizard komplett durchklicken, beim Kontakt-Schritt eine echte E-Mail eingeben
2. Prüfen, ob die Code-Mail ankommt (auch Spam-Ordner)
3. Code im Wizard eingeben und bestätigen
4. Prüfen, ob danach die PDF-Mail + interne Benachrichtigung ankommen

Bei Problemen: Render-Dashboard → Service → **Logs** — jeder Agent
loggt seinen Schritt (`[Jonas]`, `[Clara]`, `[Tim]`, `[Elena]`), das
zeigt meist sofort, wo es hakt.

## Bekannte Einschränkung

Die Bestätigungscodes werden nur im Arbeitsspeicher gehalten (kein
Datenbank-Backend). Startet der Render-Dienst neu (z.B. nach
Inaktivität beim kostenlosen Plan), gehen noch offene, unbestätigte
Codes verloren — der Kunde müsste sich in dem seltenen Fall einen
neuen Code schicken lassen. Für den aktuellen Umfang unkritisch.
