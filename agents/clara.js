/**
 * CLARA — Immobilienanalystin
 * ────────────────────────────
 * Profil: Sachlich, präzise, aber nahbar. Erklärt Bewertungen so, dass
 * sie auch Laien ohne Vorkenntnisse sofort verstehen — ohne
 * Fachchinesisch, ohne Übertreibung, immer ehrlich in der Einschätzung.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getBasispreis, getMietpreis, pruefeMietpreisbremse, getPreisverlauf, getMietverlauf } = require('./regionalpreise');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const fmt = (n) => n.toLocaleString('de-DE') + ' €';

// Dieselbe Formel wie im Frontend-Wizard (calcWert), damit die
// Bewertung serverseitig unabhängig und konsistent nachvollzogen wird —
// wir verlassen uns nicht auf ggf. bereits vom Client mitgeschickte Werte.
function berechneWert(daten) {
  const wfl = daten.wohnflaeche;

  // Regionaler Richtpreis als Ausgangsbasis (statt fixem Pauschalwert)
  const typKurz = (daten.typ || '').toLowerCase().includes('wohnung') ? 'wohnung' : 'haus';
  let base = getBasispreis(daten.ort, typKurz);

  // Ausstattung als relativer Auf-/Abschlag auf den Richtpreis
  if (daten.ausstattung === 'gehoben') base *= 1.25;
  if (daten.ausstattung === 'luxus') base *= 1.7;
  if (daten.ausstattung === 'einfach') base *= 0.75;
  if (daten.zustand === 'vollsaniert') base *= 1.15;
  if (daten.zustand === 'renovierungsbedarf') base *= 0.80;
  if (daten.baujahr === 'nach2015') base *= 1.12;
  if (daten.baujahr === 'vor1950') base *= 0.90;

  const low = Math.round((wfl * base * 0.95) / 1000) * 1000;
  const high = Math.round((wfl * base * 1.05) / 1000) * 1000;
  const avg = Math.round((low + high) / 2 / 1000) * 1000;
  return { low, high, avg };
}

const BEWERTUNGSSTUFEN = {
  sehrpositiv: { label: 'Sehr positiv', pct: 95 },
  positiv:     { label: 'Positiv',       pct: 75 },
  neutral:     { label: 'Neutral',       pct: 50 },
  negativ:     { label: 'Eher negativ',  pct: 25 }
};

// Leitet die im PDF gezeigten "Wertbeeinflussenden Faktoren" aus den
// echten Bewertungsdaten ab (keine Platzhalter-Werte).
function leiteFaktorenAb(daten, preisverlauf) {
  const faktoren = [];
  const { REGIONAL_PREISE } = require('./regionalpreise');
  const TOP_STAEDTE = ['münchen', 'muenchen', 'hamburg', 'frankfurt', 'frankfurt am main', 'berlin', 'stuttgart'];
  const ortKey = (daten.ort || '').trim().toLowerCase();

  // Lage
  if (TOP_STAEDTE.includes(ortKey)) faktoren.push({ name: 'Lage', ...BEWERTUNGSSTUFEN.sehrpositiv });
  else if (REGIONAL_PREISE[ortKey]) faktoren.push({ name: 'Lage', ...BEWERTUNGSSTUFEN.positiv });
  else faktoren.push({ name: 'Lage', ...BEWERTUNGSSTUFEN.neutral });

  // Wohnfläche
  faktoren.push({ name: 'Wohnfläche', ...(daten.wohnflaeche >= 60 ? BEWERTUNGSSTUFEN.positiv : BEWERTUNGSSTUFEN.neutral) });

  // Baujahr / Zustand
  if (daten.zustand === 'vollsaniert' || daten.baujahr === 'nach2015') faktoren.push({ name: 'Baujahr / Zustand', ...BEWERTUNGSSTUFEN.sehrpositiv });
  else if (daten.zustand === 'renovierungsbedarf') faktoren.push({ name: 'Baujahr / Zustand', ...BEWERTUNGSSTUFEN.negativ });
  else faktoren.push({ name: 'Baujahr / Zustand', ...BEWERTUNGSSTUFEN.positiv });

  // Ausstattung
  if (daten.ausstattung === 'luxus') faktoren.push({ name: 'Ausstattung', ...BEWERTUNGSSTUFEN.sehrpositiv });
  else if (daten.ausstattung === 'gehoben') faktoren.push({ name: 'Ausstattung', ...BEWERTUNGSSTUFEN.positiv });
  else if (daten.ausstattung === 'einfach') faktoren.push({ name: 'Ausstattung', ...BEWERTUNGSSTUFEN.negativ });
  else faktoren.push({ name: 'Ausstattung', ...BEWERTUNGSSTUFEN.neutral });

  // Grundstücksgröße (nur bei Häusern mit Angabe)
  if (daten.grundstueck) {
    faktoren.push({ name: 'Grundstücksgröße', ...(daten.grundstueck >= 500 ? BEWERTUNGSSTUFEN.positiv : BEWERTUNGSSTUFEN.neutral) });
  }

  // Energieeffizienz (falls angegeben, sonst neutral)
  const eff = daten.energieeffizienz;
  if (eff === 'A+' || eff === 'A') faktoren.push({ name: 'Energieeffizienz', ...BEWERTUNGSSTUFEN.sehrpositiv });
  else if (eff === 'B' || eff === 'C') faktoren.push({ name: 'Energieeffizienz', ...BEWERTUNGSSTUFEN.positiv });
  else if (eff === 'F' || eff === 'G' || eff === 'H') faktoren.push({ name: 'Energieeffizienz', ...BEWERTUNGSSTUFEN.negativ });
  else faktoren.push({ name: 'Energieeffizienz', ...BEWERTUNGSSTUFEN.neutral });

  // Marktsituation (anhand des modellierten Preisverlaufs der letzten 2 Jahre)
  if (preisverlauf && preisverlauf.length >= 2) {
    const letztes = preisverlauf[preisverlauf.length - 1].preis;
    const vorletztes = preisverlauf[preisverlauf.length - 2].preis;
    faktoren.push({ name: 'Marktsituation', ...(letztes >= vorletztes ? BEWERTUNGSSTUFEN.positiv : BEWERTUNGSSTUFEN.neutral) });
  }

  return faktoren;
}

function fallbackText(daten, wert) {
  return {
    einschaetzung: `Ihre ${daten.typ} in ${daten.ort || 'Ihrer Region'} liegt mit einer geschätzten ` +
      `Preisspanne von ${fmt(wert.low)} bis ${fmt(wert.high)} im marktüblichen Rahmen für ` +
      `vergleichbare Objekte dieser Größe und Ausstattung.`,
    highlights: [
      daten.zustand === 'vollsaniert' ? 'Vollsanierter Zustand steigert den Wert' : 'Solider Gesamtzustand',
      daten.baujahr === 'nach2015' ? 'Neubau-Standard wirkt sich positiv aus' : 'Baujahr im marktüblichen Rahmen',
      daten.merkmale.length ? `Zusatzmerkmale wie ${daten.merkmale[0]} steigern die Attraktivität` : 'Solide Grundausstattung'
    ],
    kaeuferprofil: 'Vor allem Käufer, die eine Immobilie zur Eigennutzung oder als Kapitalanlage suchen.'
  };
}

async function analysiere(daten) {
  const wert = berechneWert(daten);
  const mietpreis = getMietpreis(daten.ort);
  const mietpreisbremse = pruefeMietpreisbremse(daten);
  const typKurzVerlauf = (daten.typ || '').toLowerCase().includes('wohnung') ? 'wohnung' : 'haus';
  const preisverlauf = getPreisverlauf(daten.ort, typKurzVerlauf);
  const istVermietet = daten.nutzung === 'vermietet';
  const mietverlauf = istVermietet ? getMietverlauf(daten.ort) : null;
  let faktoren;
  try {
    faktoren = leiteFaktorenAb(daten, preisverlauf);
    if (!Array.isArray(faktoren) || faktoren.length === 0) throw new Error('leer');
  } catch (err) {
    console.error('[Clara] Faktoren-Ableitung fehlgeschlagen, nutze Fallback:', err.message);
    faktoren = [
      { name: 'Lage', ...BEWERTUNGSSTUFEN.neutral },
      { name: 'Wohnfläche', ...BEWERTUNGSSTUFEN.neutral },
      { name: 'Baujahr / Zustand', ...BEWERTUNGSSTUFEN.neutral },
      { name: 'Ausstattung', ...BEWERTUNGSSTUFEN.neutral },
      { name: 'Marktsituation', ...BEWERTUNGSSTUFEN.neutral }
    ];
  }

  const systemPrompt =
    'Du bist Clara, Immobilienanalystin bei ImmoWertChecker. Sachlich, präzise, aber nahbar. ' +
    'Du schreibst ausschließlich auf Deutsch, in kurzen, klaren Sätzen ohne Floskeln oder Fachchinesisch.';

  const typKurz = (daten.typ || '').toLowerCase().includes('wohnung') ? 'wohnung' : 'haus';
  const richtpreis = getBasispreis(daten.ort, typKurz);

  const userPrompt = `
Erstelle eine kurze, verständliche Einschätzung für folgende Immobilie:

- Typ: ${daten.typ}
- Lage: ${daten.plz} ${daten.ort}
- Regionaler Richtpreis (Ø €/m² für diesen Immobilientyp in dieser Stadt bzw. bundesweit als Näherung): ${richtpreis} €/m²
- Regionale Ø-Kaltmiete: ${mietpreis} €/m²
- Mietpreisbremse: ${mietpreisbremse.greiftNicht ? `Greift nach den Angaben voraussichtlich NICHT (${mietpreisbremse.begruendung}). Erwähne das kurz als positiven Punkt für die Ertragsperspektive, aber ohne es als abschließende Rechtsauskunft darzustellen (z.B. "nach aktuellem Stand", "voraussichtlich").` : 'Keine Angaben, die für eine Ausnahme sprechen — nicht erwähnen.'}
- Wohnfläche: ${daten.wohnflaeche} m²
${daten.grundstueck ? `- Grundstück: ${daten.grundstueck} m²\n` : ''}- Baujahr: ${daten.baujahr}
- Zustand: ${daten.zustand}
- Ausstattung: ${daten.ausstattung}
- Heizung: ${daten.heizung}
- Besondere Merkmale: ${daten.merkmale.length ? daten.merkmale.join(', ') : 'keine angegeben'}
- Geschätzte Preisspanne: ${fmt(wert.low)} – ${fmt(wert.high)} (Durchschnitt ${fmt(wert.avg)})

Antworte NUR mit JSON in exakt diesem Format, kein weiterer Text:
{
  "einschaetzung": "2-3 Sätze allgemeine Einordnung des Werts",
  "highlights": ["3 kurze Stichpunkte, was den Wert positiv beeinflusst"],
  "kaeuferprofil": "1 Satz, welche Zielgruppe typischerweise an so einer Immobilie interessiert ist"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const text_parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return { wert, text: text_parsed, mietpreis, mietpreisbremse, preisverlauf, mietverlauf, istVermietet, faktoren };
  } catch (err) {
    console.error('[Clara] Claude-Anfrage fehlgeschlagen, nutze Fallback-Text:', err.message);
    return { wert, text: fallbackText(daten, wert), mietpreis, mietpreisbremse, preisverlauf, mietverlauf, istVermietet, faktoren };
  }
}

module.exports = { analysiere, berechneWert, fmt };
