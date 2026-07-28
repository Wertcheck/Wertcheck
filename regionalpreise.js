/**
 * REGIONALPREISE — Hilfsmodul für regionale Richtpreise
 * ────────────────────────────────────────────────────────
 * Durchschnittliche Kaufpreise (€/m²) für Wohnungen und Häuser,
 * nach Stadt. Datenbasis: öffentlich publizierte Marktberichte
 * (Immowelt, ImmoScout24, Dr. Klein Trendindikator), keine
 * proprietären/lizenzpflichtigen Datensätze.
 *
 * Stand: Juli 2026 — bitte alle paar Monate manuell aktualisieren,
 * z.B. anhand der Preisatlanten von immowelt.de/immobilienpreise
 * oder immobilienscout24.de/immobilienpreise.
 *
 * Deckt nur größere Städte ab. Für alles andere greift der
 * bundesweite Durchschnitt als Näherung.
 */

const REGIONAL_PREISE = {
  // Stadt (kleingeschrieben) -> { wohnung: €/m² Kauf, haus: €/m² Kauf, miete: €/m² Kaltmiete (Wohnung) }
  'münchen':              { wohnung: 8168, haus: 9083, miete: 22.64 },
  'muenchen':             { wohnung: 8168, haus: 9083, miete: 22.64 },
  'hamburg':              { wohnung: 5921, haus: 4200, miete: 17.18 },
  'frankfurt am main':    { wohnung: 5519, haus: 4300, miete: 19.62 },
  'frankfurt':            { wohnung: 5519, haus: 4300, miete: 19.62 },
  'berlin':               { wohnung: 4970, haus: 3906, miete: 18.29 },
  'köln':                 { wohnung: 4940, haus: 3232, miete: 13.07 },
  'koeln':                { wohnung: 4940, haus: 3232, miete: 13.07 },
  'düsseldorf':           { wohnung: 4522, haus: 3600, miete: 16.04 },
  'duesseldorf':          { wohnung: 4522, haus: 3600, miete: 16.04 },
  'stuttgart':            { wohnung: 4458, haus: 3900, miete: 17.26 },
  'nürnberg':             { wohnung: 4200, haus: 3400, miete: 12.50 },
  'nuernberg':            { wohnung: 4200, haus: 3400, miete: 12.50 },
  'hannover':             { wohnung: 3300, haus: 2800, miete: 11.80 },
  'bremen':               { wohnung: 3100, haus: 2600, miete: 10.90 },
  'dresden':              { wohnung: 3087, haus: 2700, miete: 10.50 },
  'leipzig':              { wohnung: 2900, haus: 2500, miete: 9.09 },
  'dortmund':             { wohnung: 2730, haus: 2200, miete: 8.84 },
  'essen':                { wohnung: 2200, haus: 2000, miete: 9.22 },
  'duisburg':             { wohnung: 1900, haus: 1800, miete: 8.20 },
  'bochum':               { wohnung: 2100, haus: 1900, miete: 8.60 },
};

// Bundesweiter Durchschnitt als Fallback, wenn die Stadt nicht in der Liste steht
const NATIONAL_DURCHSCHNITT = { wohnung: 3277, haus: 2871, miete: 9.23 };

/**
 * Liefert den Richtpreis (€/m²) für eine Stadt und einen Immobilientyp.
 * @param {string} ort - Stadtname aus den Kundendaten
 * @param {string} typ - "wohnung" oder alles andere (=> Haus-Wert)
 */
function getBasispreis(ort, typ) {
  const fallback = typ === 'wohnung' ? NATIONAL_DURCHSCHNITT.wohnung : NATIONAL_DURCHSCHNITT.haus;
  if (!ort) return fallback;
  const key = ort.trim().toLowerCase();
  const eintrag = REGIONAL_PREISE[key];
  if (!eintrag) return fallback;
  return typ === 'wohnung' ? eintrag.wohnung : eintrag.haus;
}

/**
 * Liefert die durchschnittliche Kaltmiete (€/m²) für eine Stadt.
 */
function getMietpreis(ort) {
  if (!ort) return NATIONAL_DURCHSCHNITT.miete;
  const key = ort.trim().toLowerCase();
  const eintrag = REGIONAL_PREISE[key];
  return eintrag ? eintrag.miete : NATIONAL_DURCHSCHNITT.miete;
}

/**
 * Prüft, ob die Mietpreisbremse (§ 556d BGB) NICHT greift — z.B. weil
 * die Wohnung nach dem 01.10.2014 erstmals bezugsfertig war (§ 556f
 * Satz 1 BGB) oder umfassend modernisiert wurde (§ 556f Satz 2 BGB).
 *
 * Hinweis: Das ist eine grobe Einschätzung anhand der Wizard-Angaben,
 * keine verbindliche Rechtsprüfung. Der Baujahr-Bereich "2001-2015"
 * ist bewusst NICHT als eindeutig neu genug eingestuft, da der genaue
 * Stichtag (01.10.2014) darin liegen kann — nur "nach2015" gilt als
 * sicher.
 */
function pruefeMietpreisbremse(daten) {
  const istNeubauNach2014 = daten.baujahr_wohnung === 'nach2015' || daten.baujahr === 'nach2015';
  const istUmfassendModernisiert = !!daten.umfassend_modernisiert;

  if (istNeubauNach2014) {
    return {
      greiftNicht: true,
      begruendung: 'Neubau nach dem 01.10.2014 (§ 556f Satz 1 BGB) — die Mietpreisbremse gilt hierfür nicht, es kann eine marktübliche Miete erzielt werden.'
    };
  }
  if (istUmfassendModernisiert) {
    return {
      greiftNicht: true,
      begruendung: 'Umfassend modernisiert im Sinne von § 556f Satz 2 BGB — die Mietpreisbremse gilt hierfür nicht, sofern die Modernisierungskosten mindestens ein Drittel der Neubaukosten betragen haben.'
    };
  }
  return { greiftNicht: false, begruendung: null };
}

/**
 * Liefert einen modellierten Preisverlauf der letzten 10 Jahre für
 * Kaufpreise, ausgehend vom aktuellen Richtpreis.
 *
 * Wichtig: Das sind KEINE echten historischen Transaktionsdaten (die
 * liegen uns nicht vor), sondern eine Rückrechnung anhand des
 * dokumentierten bundesweiten Marktverlaufs (stetiger Anstieg bis
 * 2022, Rückgang 2022–2024, Stabilisierung ab 2025) — angewendet auf
 * den aktuellen regionalen Richtpreis. Für die grobe Einordnung "wie
 * hat sich der Markt entwickelt" ausreichend, aber kein Ersatz für
 * einen echten Kaufpreisindex.
 */
const MARKTVERLAUF_FAKTOREN = {
  // Jahr -> Faktor relativ zum aktuellen Jahr (2026 = 1.0)
  2016: 0.62, 2017: 0.68, 2018: 0.74, 2019: 0.80, 2020: 0.86,
  2021: 0.94, 2022: 1.02, 2023: 0.97, 2024: 0.94, 2025: 0.97, 2026: 1.0
};

function getPreisverlauf(ort, typ) {
  const aktuellerPreis = getBasispreis(ort, typ);
  return Object.entries(MARKTVERLAUF_FAKTOREN).map(([jahr, faktor]) => ({
    jahr: Number(jahr),
    preis: Math.round(aktuellerPreis * faktor)
  }));
}

function getMietverlauf(ort) {
  const aktuelleMiete = getMietpreis(ort);
  // Mieten steigen erfahrungsgemäß stetiger und schwanken weniger stark als Kaufpreise
  const MIET_FAKTOREN = {
    2016: 0.74, 2017: 0.78, 2018: 0.82, 2019: 0.86, 2020: 0.89,
    2021: 0.92, 2022: 0.95, 2023: 0.97, 2024: 0.99, 2025: 1.0, 2026: 1.0
  };
  return Object.entries(MIET_FAKTOREN).map(([jahr, faktor]) => ({
    jahr: Number(jahr),
    miete: Math.round(aktuelleMiete * faktor * 100) / 100
  }));
}

module.exports = { getBasispreis, getMietpreis, pruefeMietpreisbremse, getPreisverlauf, getMietverlauf, REGIONAL_PREISE, NATIONAL_DURCHSCHNITT };
