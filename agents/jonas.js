/**
 * JONAS — Koordinator
 * Empfängt die Kundendaten und koordiniert Clara, Tim und Elena.
 * Er entscheidet die Reihenfolge und gibt Aufgaben weiter.
 */

const clara = require('./clara');
const tim   = require('./tim');
const elena = require('./elena');

async function verarbeiten(kundendaten) {
  console.log('🟡 Jonas: Neue Anfrage empfangen von', kundendaten.vorname);

  // ── SCHRITT 1: Clara erstellt die Bewertung ─────────────────
  console.log('🔵 Jonas → Clara: Bewertung anfordern...');
  const bewertung = await clara.bewerten(kundendaten);
  console.log('✅ Clara: Bewertung fertig');

  // ── SCHRITT 2: Tim erstellt das PDF ─────────────────────────
  console.log('🔵 Jonas → Tim: PDF erstellen...');
  const pdfBuffer = await tim.erstellePDF(kundendaten, bewertung);
  console.log('✅ Tim: PDF fertig');

  // ── SCHRITT 3: Elena versendet alles ────────────────────────
  console.log('🔵 Jonas → Elena: E-Mails versenden...');
  await elena.versenden(kundendaten, bewertung, pdfBuffer);
  console.log('✅ Elena: E-Mails versendet');

  console.log('🟢 Jonas: Auftrag abgeschlossen für', kundendaten.email);

  // ── FOLLOW-UP E-MAIL nach 3 Tagen ────────────────────────────
  const drei_tage_ms = 3 * 24 * 60 * 60 * 1000;
  setTimeout(async () => {
    try {
      await elena.sendeFollowUp(kundendaten, bewertung);
      console.log('📧 Jonas: Follow-up E-Mail versendet an', kundendaten.email);
    } catch(e) {
      console.error('Follow-up Fehler:', e.message);
    }
  }, drei_tage_ms);

  return {
    status: 'abgeschlossen',
    kunde: kundendaten.email,
    wert_low: bewertung.wert_low,
    wert_high: bewertung.wert_high,
    wert_avg: bewertung.wert_avg,
  };
}

module.exports = { verarbeiten };
