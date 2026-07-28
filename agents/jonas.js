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
// Die Wohnung-Detailseiten im Wizard erheben feinere Felder
// (baujahr_wohnung statt baujahr, vier einzelne Raum-Zustände statt
// einem "zustand", keine direkte "ausstattung") — die werden hier auf
// die generischen Felder abgebildet, die die Preisformel in Clara
// erwartet. Ohne das würden Zustand/Ausstattung/Baujahr bei jeder
// Wohnungs-Bewertung stillschweigend ignoriert.
function leiteZustandAb(rohdaten) {
  if (rohdaten.zustand) return rohdaten.zustand; // Haus/Gewerbe haben das Feld direkt
  if (rohdaten.umfassend_modernisiert) return 'vollsaniert';
  const raeume = [rohdaten.kuechenzustand, rohdaten.badzustand, rohdaten.fussbodenzustand, rohdaten.fensterzustand].filter(Boolean);
  if (!raeume.length) return 'gepflegt';
  const anzahlNeu = raeume.filter(r => r === 'neu').length;
  const anzahlReno = raeume.filter(r => r === 'renovierungsbeduerftig').length;
  if (anzahlReno > raeume.length / 2) return 'renovierungsbedarf';
  if (anzahlNeu > raeume.length / 2) return 'vollsaniert';
  return 'gepflegt';
}

function leiteAusstattungAb(rohdaten) {
  if (rohdaten.ausstattung) return rohdaten.ausstattung; // Haus/Gewerbe haben das Feld direkt
  const eff = rohdaten.energieeffizienz;
  if (eff === 'A+' || eff === 'A') return 'gehoben';
  if (eff === 'F' || eff === 'G' || eff === 'H') return 'einfach';
  return 'normal';
}

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
    wohnflaeche: parseInt(rohdaten.wohnflaeche) || parseInt(rohdaten.wohnflaeche_qm) || 100,
    grundstueck: parseInt(rohdaten.grundstueck) || null,
    baujahr: rohdaten.baujahr || rohdaten.baujahr_wohnung || 'unbekannt',
    zustand: leiteZustandAb(rohdaten),
    ausstattung: leiteAusstattungAb(rohdaten),
    heizung: rohdaten.heizung || 'unbekannt',
    nutzung: rohdaten.nutzung || null,
    umfassend_modernisiert: !!rohdaten.umfassend_modernisiert,
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
