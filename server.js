require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const jonas   = require('./agents/jonas');

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

// ── HAUPTENDPUNKT: Bewertungsanfrage ───────────────────────────
// Wird vom Wizard auf der Website aufgerufen
app.post('/bewertung', async (req, res) => {
  console.log('📥 Neue Bewertungsanfrage:', req.body.email);

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
