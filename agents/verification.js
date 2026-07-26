/**
 * VERIFICATION — Hilfsmodul für die E-Mail-Bestätigung
 * ──────────────────────────────────────────────────────
 * Kein eigener "Agent" mit Persönlichkeit, sondern eine technische
 * Zutat, die Elena (Versand) und den Server-Endpunkt unterstützt:
 * Codes erzeugen, kurzzeitig speichern, prüfen.
 *
 * Hinweis: Die Codes werden nur im Arbeitsspeicher gehalten. Bei
 * einem Neustart des Render-Dienstes (z.B. nach Inaktivität beim
 * kostenlosen Plan) gehen offene, noch nicht bestätigte Codes
 * verloren — der Kunde müsste sich dann einen neuen Code schicken
 * lassen. Für den Start reicht das; bei höherem Volumen könnte man
 * das später in einer echten Datenbank speichern.
 */

const codes = new Map();      // email -> { code, expiresAt }
const verified = new Map();   // email -> expiresAt (kurzes Zeitfenster nach erfolgreicher Prüfung)

const CODE_GUELTIGKEIT_MS = 10 * 60 * 1000;      // 10 Minuten
const VERIFIED_GUELTIGKEIT_MS = 15 * 60 * 1000;  // 15 Minuten, um danach /bewertung auszulösen

function generiereCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-stellig, führende 0 ausgeschlossen
}

function speichereCode(email) {
  const code = generiereCode();
  codes.set(email, { code, expiresAt: Date.now() + CODE_GUELTIGKEIT_MS });
  return code;
}

function pruefeCode(email, eingabe) {
  const eintrag = codes.get(email);
  if (!eintrag) return false;
  if (Date.now() > eintrag.expiresAt) { codes.delete(email); return false; }
  if (eintrag.code !== String(eingabe).trim()) return false;

  // Code war korrekt — verbrauchen (kein zweites Mal nutzbar) und als verifiziert markieren
  codes.delete(email);
  verified.set(email, Date.now() + VERIFIED_GUELTIGKEIT_MS);
  return true;
}

function istVerifiziert(email) {
  const bis = verified.get(email);
  if (!bis) return false;
  if (Date.now() > bis) { verified.delete(email); return false; }
  return true;
}

module.exports = { speichereCode, pruefeCode, istVerifiziert };
