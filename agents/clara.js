/**
 * CLARA — Bewertungs-Agentin
 * Analysiert die Immobiliendaten und erstellt eine professionelle
 * Marktwerteinschätzung mit individuellen Texten per Claude API.
 */

const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── WERTBERECHNUNG ─────────────────────────────────────────────
function berechneWert(daten) {
  const wfl = parseInt(daten.wohnflaeche) || 100;
  let basis = 3000;

  // Ausstattung
  if (daten.ausstattung === 'luxus')    basis = 6000;
  if (daten.ausstattung === 'gehoben')  basis = 4200;
  if (daten.ausstattung === 'normal')   basis = 3000;
  if (daten.ausstattung === 'einfach')  basis = 2200;

  // Zustand
  if (daten.zustand === 'vollsaniert')       basis *= 1.15;
  if (daten.zustand === 'teilmodernisiert')  basis *= 1.05;
  if (daten.zustand === 'renovierungsbedarf') basis *= 0.80;

  // Baujahr
  if (daten.baujahr === 'nach2015')   basis *= 1.12;
  if (daten.baujahr === '2000-2015')  basis *= 1.05;
  if (daten.baujahr === '1950-1979')  basis *= 0.92;
  if (daten.baujahr === 'vor1950')    basis *= 0.88;

  // Heizung (Energieeffizienz)
  if (daten.heizung === 'waermepumpe') basis *= 1.08;
  if (daten.heizung === 'solar')       basis *= 1.06;
  if (daten.heizung === 'oel')         basis *= 0.95;

  const avg  = Math.round((wfl * basis) / 1000) * 1000;
  const low  = Math.round((avg * 0.92) / 1000) * 1000;
  const high = Math.round((avg * 1.08) / 1000) * 1000;

  return { wert_low: low, wert_avg: avg, wert_high: high, qm_preis: Math.round(basis) };
}

// ── KI-BEWERTUNGSTEXT ──────────────────────────────────────────
async function bewerten(daten) {
  // Lokale Berechnung
  const werte = berechneWert(daten);

  // System-Prompt: Claras Persönlichkeit und Auftrag
  const systemPrompt = `Du bist Clara, eine erfahrene Immobilienbewertungs-Expertin bei WertCheck.
Du erstellst professionelle, präzise und vertrauenswürdige Immobilienbewertungen für Eigentümer in Deutschland.

Deine Tonalität:
- Professionell aber persönlich
- Sachlich und datenbasiert
- Niemals übertrieben positiv oder negativ
- Immer auf Deutsch

Wichtige Regeln:
- Niemals "Makler" schreiben — immer "Immobilienberater"
- Keine unrealistischen Versprechen
- Immer darauf hinweisen dass dies eine Ersteinschätzung ist`;

  // User-Prompt mit den Kundendaten
  const userPrompt = `Erstelle eine professionelle Immobilienbewertung für folgendes Objekt:

OBJEKTDATEN:
- Typ: ${daten.typ || '–'}
- Ort: ${daten.plz} ${daten.ort}
- Wohnfläche: ${daten.wohnflaeche} m²
- Grundstück: ${daten.grundstueck} m²
- Baujahr: ${daten.baujahr}
- Zustand: ${daten.zustand}
- Ausstattung: ${daten.ausstattung}
- Heizung: ${daten.heizung}
- Besonderheiten: ${Array.isArray(daten.merkmale) ? daten.merkmale.join(', ') : (daten.merkmale || 'keine')}
- Ziel des Eigentümers: ${daten.ziel}
- Zeitplan: ${daten.zeitplan}

BERECHNETER MARKTWERT:
- Niedrig: ${werte.wert_low.toLocaleString('de-DE')} €
- Durchschnitt: ${werte.wert_avg.toLocaleString('de-DE')} €
- Hoch: ${werte.wert_high.toLocaleString('de-DE')} €
- Preis pro m²: ${werte.qm_preis.toLocaleString('de-DE')} €

Erstelle folgende Texte (jeweils 2-4 Sätze):
1. ZUSAMMENFASSUNG: Kurze Einschätzung des Objekts und seiner Marktposition
2. LAGEANALYSE: Einschätzung der Lage basierend auf PLZ/Ort
3. WERTTREIBER: Was den Wert dieser Immobilie positiv beeinflusst
4. HANDLUNGSEMPFEHLUNG: Konkrete nächste Schritte für den Eigentümer

Antworte NUR als JSON in diesem Format:
{
  "zusammenfassung": "...",
  "lageanalyse": "...",
  "werttreiber": "...",
  "handlungsempfehlung": "..."
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = response.content[0].text;
    const texte = JSON.parse(text.replace(/```json|```/g, '').trim());

    return {
      ...werte,
      ...texte,
      kunde_name: `${daten.vorname} ${daten.nachname}`,
      datum: new Date().toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }),
    };

  } catch (error) {
    console.error('Clara API Fehler:', error.message);
    // Fallback ohne KI-Text
    return {
      ...werte,
      zusammenfassung: `Ihre Immobilie in ${daten.plz} ${daten.ort} wurde auf Basis Ihrer Angaben bewertet.`,
      lageanalyse: `Die Lage in ${daten.ort} wurde in unsere Bewertung einbezogen.`,
      werttreiber: `${daten.ausstattung} Ausstattung und ${daten.zustand}er Zustand beeinflussen den Wert positiv.`,
      handlungsempfehlung: 'Wir empfehlen ein persönliches Gespräch mit einem erfahrenen Immobilienberater.',
      kunde_name: `${daten.vorname} ${daten.nachname}`,
      datum: new Date().toLocaleDateString('de-DE'),
    };
  }
}

module.exports = { bewerten };
