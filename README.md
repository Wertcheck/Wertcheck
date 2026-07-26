# WertCheck Backend

KI-Agenten-Team für die automatische Immobilienbewertung.

## Struktur

```
server.js              ← Einstiegspunkt: Express-Server + /bewertung-Endpunkt
agents/
  jonas.js              ← Koordinator: nimmt Wizard-Daten entgegen, steuert den Ablauf
  clara.js              ← Immobilienanalystin: berechnet den Wert, schreibt die Analyse (Claude API)
  tim.js                ← Dokumenten-Spezialist: erstellt das PDF
  elena.js              ← Kundenkommunikation: verschickt E-Mails (SendGrid API)
```

## Das Team

| Agent | Rolle | Aufgabe |
|-------|-------|---------|
| **Jonas** | Koordinator | Vereinheitlicht die Wizard-Daten, reicht sie durchs Team, fängt Fehler ab |
| **Clara** | Immobilienanalystin | Berechnet den Marktwert und schreibt die verständliche Einschätzung (via Claude API) |
| **Tim** | Dokumenten-Spezialist | Baut daraus das fertige, gebrandete PDF |
| **Elena** | Kundenkommunikation | Versendet die E-Mail an den Kunden (mit PDF) und die interne Benachrichtigung — über die SendGrid API |

## Ablauf

```
Kunde → Website Wizard → POST /bewertung
                              ↓
                           Jonas  (Daten vereinheitlichen)
                              ↓
                           Clara  (Marktwert + Analyse via Claude)
                              ↓
                            Tim   (PDF erstellen)
                              ↓
                           Elena  (E-Mail an Kunde + intern via SendGrid)
```

## Setup auf Render.com

### 1. GitHub Repository
Alle Dateien hochladen — **inklusive dem `agents/`-Ordner mit allen vier Dateien**:
```
server.js
package.json
agents/jonas.js
agents/clara.js
agents/tim.js
agents/elena.js
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

**Wichtig:** `SENDER_EMAIL` und `REPLY_TO_EMAIL` müssen bei SendGrid unter
**Sender Authentication → Verified Senders** freigegeben sein, sonst lehnt
SendGrid den Versand ab.

### 4. Website-URL prüfen

Da `server.js` die `index.html` gleich selbst mit ausliefert (`express.static`),
muss der `fetch(...)`-Aufruf im Wizard auf genau diese Render-URL zeigen:

```js
fetch('https://DEINE-RENDER-URL.onrender.com/bewertung', ...)
```

## Testen

Nach dem Deploy: die Website unter der Render-URL aufrufen, kompletten
Wizard durchklicken, prüfen ob:

1. Die Erfolgsmeldung auf der Website erscheint
2. Die PDF-E-Mail beim Test-Kunden ankommt
3. Die interne Benachrichtigung bei `INTERN_EMAIL` ankommt

Bei Problemen: Render-Dashboard → Service → **Logs** — jeder Agent loggt
seinen Schritt (`[Jonas]`, `[Clara]`, `[Tim]`, `[Elena]`), das zeigt
meist sofort, wo es hakt.
