require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const jonas   = require('./agents/jonas');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── HEALTH CHECK ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'WertCheck Backend läuft ✅', version: '1.0.0' });
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
  console.log(`✅ WertCheck Backend läuft auf Port ${PORT}`);
});
