require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const jonas   = require('./agents/jonas');
const elena   = require('./agents/elena');
const verification = require('./agents/verification');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── STATISCHE DATEIEN (Website) ────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── HAUPTSEITE ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── E-MAIL-VERIFIZIERUNG ────────────────────────────────────────
// Wird aufgerufen, sobald der Kunde im Wizard seine Kontaktdaten
// abgeschickt hat — bevor die eigentliche Bewertung verschickt wird.
app.post('/send-code', async (req, res) => {
  const { email, vorname } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'E-Mail-Adresse fehlt.' });

  try {
    const code = verification.speichereCode(email);
    await elena.sendeCode(email, vorname, code);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [send-code] Fehler:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, error: 'E-Mail oder Code fehlt.' });

  const ok = verification.pruefeCode(email, code);
  res.json({ success: ok });
});

// ── HAUPTENDPUNKT: Bewertungsanfrage ───────────────────────────
// Wird vom Wizard auf der Website aufgerufen, NACHDEM der Kunde
// seinen Bestätigungscode erfolgreich eingegeben hat.
app.post('/bewertung', async (req, res) => {
  console.log('📥 Neue Bewertungsanfrage:', req.body.email);

  // Serverseitige Absicherung: nicht nur dem Frontend vertrauen,
  // dass die Verifizierung stattgefunden hat.
  if (!verification.istVerifiziert(req.body.email)) {
    console.warn('⚠️  Anfrage ohne gültige E-Mail-Verifizierung abgelehnt:', req.body.email);
    return res.status(403).json({ success: false, fehler: 'E-Mail-Adresse wurde nicht bestätigt.' });
  }

  try {
    // Jonas koordiniert alle Agenten
    const ergebnis = await jonas.verarbeiten(req.body);
    res.json({ success: true, ergebnis });
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    res.status(500).json({ success: false, fehler: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ ImmoWertChecker Backend läuft auf Port ${PORT}`);
});
