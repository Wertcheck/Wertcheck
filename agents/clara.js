/**
 * CLARA — Immobilienanalystin
 * ────────────────────────────
 * Profil: Sachlich, präzise, aber nahbar. Erklärt Bewertungen so, dass
 * sie auch Laien ohne Vorkenntnisse sofort verstehen — ohne
 * Fachchinesisch, ohne Übertreibung, immer ehrlich in der Einschätzung.
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const fmt = (n) => n.toLocaleString('de-DE') + ' €';

// Dieselbe Formel wie im Frontend-Wizard (calcWert), damit die
// Bewertung serverseitig unabhängig und konsistent nachvollzogen wird —
// wir verlassen uns nicht auf ggf. bereits vom Client mitgeschickte Werte.
function berechneWert(daten) {
  const wfl = daten.wohnflaeche;
  let base = 3000;
  if (daten.ausstattung === 'gehoben') base = 4200;
  if (daten.ausstattung === 'luxus') base = 6000;
  if (daten.ausstattung === 'einfach') base = 2200;
  if (daten.zustand === 'vollsaniert') base *= 1.15;
  if (daten.zustand === 'renovierungsbedarf') base *= 0.80;
  if (daten.baujahr === 'nach2015') base *= 1.12;
  if (daten.baujahr === 'vor1950') base *= 0.90;

  const low = Math.round((wfl * base * 0.95) / 1000) * 1000;
  const high = Math.round((wfl * base * 1.05) / 1000) * 1000;
  const avg = Math.round((low + high) / 2 / 1000) * 1000;
  return { low, high, avg };
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

  const systemPrompt =
    'Du bist Clara, Immobilienanalystin bei ImmoWertChecker. Sachlich, präzise, aber nahbar. ' +
    'Du schreibst ausschließlich auf Deutsch, in kurzen, klaren Sätzen ohne Floskeln oder Fachchinesisch.';

  const userPrompt = `
Erstelle eine kurze, verständliche Einschätzung für folgende Immobilie:

- Typ: ${daten.typ}
- Lage: ${daten.plz} ${daten.ort}
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

    return { wert, text: text_parsed };
  } catch (err) {
    console.error('[Clara] Claude-Anfrage fehlgeschlagen, nutze Fallback-Text:', err.message);
    return { wert, text: fallbackText(daten, wert) };
  }
}

module.exports = { analysiere, berechneWert, fmt };
