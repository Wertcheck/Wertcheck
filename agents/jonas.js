/**
 * JONAS — Koordinator
 * ────────────────────
 * Profil: Ruhig, strukturiert, behält den Überblick über das ganze Team.
 * Nimmt die rohen Wizard-Daten entgegen, bereitet sie einheitlich auf
 * und reicht sie durchs Team: Clara → Tim → Elena.
 */

const clara = require('./clara');
const tim   = require('./tim');
const elena = require('./elena');

// Der Wizard im Frontend hat zwei leicht unterschiedliche Absende-Wege
// (Desktop vs. Mobile) — die Feldnamen weichen teils voneinander ab
// (z.B. "type" vs. "typ", merkmale als Array oder als String).
// Jonas vereinheitlicht das hier an einer Stelle, damit sich Clara,
// Tim und Elena nicht selbst darum kümmern müssen.
function normalisiere(rohdaten) {
  const merkmale = Array.isArray(rohdaten.merkmale)
    ? rohdaten.merkmale
    : (typeof rohdaten.merkmale === 'string' && rohdaten.merkmale !== '–'
        ? rohdaten.merkmale.split(',').map(s => s.trim()).filter(Boolean)
        : []);

  return {
    vorname: rohdaten.vorname || 'Kunde',
    nachname: rohdaten.nachname || '',
    email: rohdaten.email || '',
    telefon: rohdaten.telefon && rohdaten.telefon !== '–' ? rohdaten.telefon : '',
    typ: rohdaten.typ || rohdaten.type || 'Immobilie',
    plz: rohdaten.plz || '',
    ort: rohdaten.ort || '',
    wohnflaeche: parseInt(rohdaten.wohnflaeche) || 100,
    grundstueck: parseInt(rohdaten.grundstueck) || null,
    baujahr: rohdaten.baujahr || 'unbekannt',
    zustand: rohdaten.zustand || 'gepflegt',
    ausstattung: rohdaten.ausstattung || 'normal',
    heizung: rohdaten.heizung || 'unbekannt',
    merkmale,
    ziel: rohdaten.ziel || 'neugier',
    zeitplan: rohdaten.zeitplan || 'unbekannt',
    rating: rohdaten.rating || rohdaten._rating || null
  };
}

async function verarbeiten(rohdaten) {
  const daten = normalisiere(rohdaten);
  console.log(`[Jonas] Neue Anfrage von ${daten.vorname} ${daten.nachname}. Übergebe an Clara …`);

  const analyse = await clara.analysiere(daten);
  console.log(`[Jonas] Clara ist fertig (Preisspanne: ${analyse.wert.low}–${analyse.wert.high} €). Übergebe an Tim …`);

  const pdfBuffer = await tim.erstellePDF(daten, analyse);
  console.log(`[Jonas] Tim hat das PDF fertig (${pdfBuffer.length} Bytes). Übergebe an Elena …`);

  await elena.versende(daten, analyse, pdfBuffer);
  console.log(`[Jonas] Elena hat alles verschickt. Vorgang abgeschlossen.`);

  // Bewertungsanfrage per E-Mail, statt Sterne direkt im Wizard abzufragen
  if (daten.email) {
    try {
      await elena.sendeBewertungsanfrage(daten.email, daten.vorname);
    } catch (err) {
      // Nicht kritisch — die Hauptbewertung ist schon raus, also nur loggen statt abzubrechen
      console.error('[Jonas] Bewertungsanfrage konnte nicht verschickt werden:', err.message);
    }
  }

  return { daten, analyse };
}

module.exports = { verarbeiten, normalisiere };
