/**
 * TIM — Dokumenten-Spezialist
 * ────────────────────────────
 * Erstellt das PDF für die Immobilienbewertung.
 *
 * NEU (Umstieg von PDFKit auf Puppeteer): Statt jedes Element einzeln mit
 * x/y-Koordinaten zu zeichnen, wird dieselbe HTML/CSS-Vorlage befüllt, die
 * auch als Ergebnis-Seite im Browser dient (siehe berichtHTML.js), und ein
 * Headless-Chrome "druckt" sie zu PDF. Layout-Änderungen finden ab jetzt in
 * berichtHTML.js statt — hier passiert nur noch das Rendern.
 *
 * Wichtig für den Speicherverbrauch: Chrome wird EINMAL beim ersten Aufruf
 * gestartet und danach wiederverwendet (nur neue Tabs pro PDF, kein neuer
 * Browser-Prozess pro Anfrage). Das hält den RAM-Bedarf auch bei mehreren
 * Bewertungen kurz hintereinander vorhersehbar.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { erstelleBerichtHTML } = require('./berichtHTML');
const { holeKartenausschnitt } = require('../kartenausschnitt');

const HAUS_FOTO = path.join(__dirname, '..', 'haus-foto.png');

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    // Falls der Start fehlschlägt, beim nächsten Aufruf erneut versuchen
    // statt dauerhaft mit einer kaputten Promise hängen zu bleiben.
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

// Einfache Warteschlange: PDFs werden nacheinander erzeugt, nicht parallel.
// Bei ~1–3 Sekunden pro PDF ist das für unser Anfragevolumen völlig
// ausreichend und hält den Speicherbedarf konstant niedrig (siehe Absprache
// zur RAM-Dimensionierung).
let queue = Promise.resolve();
function eingereiht(fn) {
  const ausgefuehrt = queue.then(fn, fn);
  queue = ausgefuehrt.catch(() => {}); // ein Fehler darf die Kette nicht blockieren
  return ausgefuehrt;
}

async function holeKartenBase64(daten) {
  const adresse = [daten.strasse, daten.hausnummer, daten.plz, daten.ort].filter(Boolean).join(' ');
  try {
    const bild = await holeKartenausschnitt(adresse || daten.ort, 840, 396);
    return bild.toString('base64');
  } catch (e) {
    console.error('[Tim] Kartenausschnitt nicht verfügbar, nutze Fallback-Foto:', e.message);
    try {
      return fs.readFileSync(HAUS_FOTO).toString('base64');
    } catch (e2) {
      return null; // Vorlage zeigt dann den Platzhalter-Text
    }
  }
}

function erstellePDF(daten, analyse) {
  return eingereiht(async () => {
    const kartenBildBase64 = await holeKartenBase64(daten);
    const html = erstelleBerichtHTML(daten, analyse, kartenBildBase64);

    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      return buffer;
    } finally {
      await page.close(); // Tab schließen, Browser-Prozess bleibt für den nächsten Aufruf am Leben
    }
  });
}

module.exports = { erstellePDF };
