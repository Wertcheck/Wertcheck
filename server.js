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

// ── KUNDENBEWERTUNG ──────────────────────────────────────────────
// Einfache, eigenständige Seite (kein Teil des Wizards), die per
// Link aus der Bewertungsanfrage-E-Mail aufgerufen wird.
app.get('/bewerten', (req, res) => {
  const email = req.query.email || '';
  res.send(`<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bewertung abgeben — ImmoWertChecker</title>
<style>
  body { font-family: Arial, sans-serif; background:#F0F9FB; margin:0; padding:24px; color:#0D1B2A; }
  .card { max-width:420px; margin:40px auto; background:#fff; border-radius:16px; padding:32px; box-shadow:0 20px 50px rgba(0,0,0,0.1); }
  h1 { font-size:20px; margin-bottom:8px; }
  p { color:#6B7A8D; font-size:14px; }
  .stars { text-align:center; margin:24px 0; font-size:40px; }
  .stars span { cursor:pointer; color:#C8E8EE; transition:color .15s; }
  .stars span.active { color:#0097B2; }
  textarea { width:100%; box-sizing:border-box; border:2px solid #C8E8EE; border-radius:10px; padding:12px; font-size:14px; font-family:inherit; margin-bottom:16px; min-height:100px; }
  button { width:100%; background:#0097B2; color:#fff; border:none; border-radius:10px; padding:14px; font-size:15px; font-weight:bold; cursor:pointer; }
  button:disabled { background:#C8E8EE; cursor:not-allowed; }
  .danke { text-align:center; padding:20px 0; }
</style>
</head>
<body>
  <div class="card" id="card">
    <h1>Wie war Ihre Erfahrung?</h1>
    <p>Ihre Rückmeldung hilft uns und anderen Nutzern.</p>
    <div class="stars" id="stars">
      ${[1,2,3,4,5].map(i => `<span onclick="waehleSterne(${i})" id="stern-${i}">★</span>`).join('')}
    </div>
    <textarea id="text" placeholder="Was hat Ihnen gefallen? Was können wir besser machen? (optional)"></textarea>
    <button onclick="absenden()" id="btn">Bewertung abschicken</button>
  </div>
<script>
  let sterne = 0;
  function waehleSterne(n) {
    sterne = n;
    for (let i = 1; i <= 5; i++) document.getElementById('stern-' + i).classList.toggle('active', i <= n);
  }
  async function absenden() {
    if (sterne === 0) { alert('Bitte wählen Sie zunächst eine Sternebewertung aus.'); return; }
    document.getElementById('btn').disabled = true;
    document.getElementById('btn').textContent = 'Wird gesendet …';
    try {
      await fetch('/bewertung-abgeben', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email: ${JSON.stringify(email)}, sterne, text: document.getElementById('text').value })
      });
      document.getElementById('card').innerHTML = '<div class="danke"><h1>Vielen Dank!</h1><p>Ihre Bewertung wurde übermittelt.</p></div>';
    } catch (e) {
      document.getElementById('btn').disabled = false;
      document.getElementById('btn').textContent = 'Bewertung abschicken';
      alert('Leider ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.');
    }
  }
</script>
</body>
</html>`);
});

app.post('/bewertung-abgeben', async (req, res) => {
  const { email, sterne, text } = req.body;
  if (!sterne) return res.status(400).json({ success: false, error: 'Keine Sterne-Bewertung angegeben.' });

  try {
    await elena.sendeKundenbewertung(email || 'unbekannt', sterne, text);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [bewertung-abgeben] Fehler:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ ImmoWertChecker Backend läuft auf Port ${PORT}`);
});
