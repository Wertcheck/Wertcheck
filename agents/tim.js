/**
 * TIM — Dokumenten-Spezialist
 * ────────────────────────────
 * Erstellt das PDF für die Immobilienbewertung. Layout angelehnt an
 * eine vom Kunden vorgegebene Bildvorlage.
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const { fmt } = require('./clara');
const { NATIONAL_DURCHSCHNITT } = require('./regionalpreise');
const { holeKartenausschnitt } = require('./kartenausschnitt');

const NIGHT   = '#0D1B2A';
const NIGHT2  = '#16283D'; // etwas heller, für Panels auf dunklem Grund
const PETROL  = '#0097B2';
const CYAN    = '#4DD8E8'; // helles Petrol für Text auf dunklem Grund
const MUTED   = '#6B7A8D';
const TRACK   = '#C8E8EE';
const LIGHT   = '#EAF7F9';
const WHITE   = '#ffffff';

const LOGO_ICON = path.join(__dirname, 'logo-icon.png');
const HAUS_FOTO = path.join(__dirname, 'haus-foto.png');

// ── Logo: Icon-Bild + Schriftzug (kein reiner Text mehr) ──
function zeichneLogo(doc, x, y, dunkelHintergrund = true) {
  try {
    doc.image(LOGO_ICON, x, y - 2, { height: 24 });
  } catch (e) { /* Icon optional */ }
  doc.fontSize(15).font('Helvetica-Bold')
    .fillColor(dunkelHintergrund ? WHITE : NIGHT).text('IMMOWERT', x + 30, y, { continued: true });
  doc.fillColor(PETROL).text('CHECKER', { continued: false });
}

// ── Kachel mit Icon-Platzhalter (Kreis) + Label + Wert, für dunklen Hintergrund ──
function objektKachel(doc, x, y, w, label, wert) {
  doc.circle(x + 9, y + 9, 9).lineWidth(1.3).strokeColor(CYAN).stroke();
  doc.fillColor(TRACK).fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), x + 26, y, { width: w - 26 });
  doc.fillColor(WHITE).fontSize(10.5).font('Helvetica-Bold').text(wert, x + 26, y + 12, { width: w - 26 });
}

function balkenReihe(doc, x, y, w, name, pct, label, farbe) {
  doc.fillColor(NIGHT).fontSize(9.5).font('Helvetica').text(name, x, y, { width: 110 });
  const barX = x + 115, barW = w - 115 - 75;
  doc.roundedRect(barX, y + 1, barW, 6, 3).fill(TRACK);
  doc.roundedRect(barX, y + 1, Math.max(6, barW * (pct / 100)), 6, 3).fill(farbe);
  doc.fillColor(MUTED).fontSize(8.5).font('Helvetica-Bold').text(label, barX + barW + 8, y, { width: 70 });
}

// ── Dekoratives Mini-Histogramm hinter dem Preisstrahl (Glockenkurve) ──
function zeichneHistogramm(doc, x, y, w, h) {
  const werte = [0.3, 0.45, 0.6, 0.75, 0.9, 1, 0.95, 0.85, 0.7, 0.55, 0.4, 0.25];
  const n = werte.length;
  const barW = (w / n) * 0.6;
  const gap = (w / n) * 0.4;
  werte.forEach((v, i) => {
    const bx = x + i * (w / n) + gap / 2;
    const bh = h * v;
    const mitteBereich = i >= n / 2 - 2 && i <= n / 2 + 1;
    doc.rect(bx, y + h - bh, barW, bh).fill(mitteBereich ? PETROL : 'rgba(255,255,255,0.15)');
  });
}

// ── Preisstrahl auf dunklem Hintergrund ──
function zeichnePreisstrahlDunkel(doc, low, high, avg, x, y, width) {
  const pctAvg = high === low ? 0.5 : (avg - low) / (high - low);
  const avgX = x + pctAvg * width;
  doc.strokeColor('rgba(255,255,255,0.25)').lineWidth(3).moveTo(x, y).lineTo(x + width, y).stroke();
  doc.circle(x, y, 4).fill(WHITE);
  doc.circle(x + width, y, 4).fill(WHITE);
  doc.circle(avgX, y, 7).fill(WHITE);
  doc.circle(avgX, y, 3.5).fill(PETROL);
  return y;
}

function zeichneLinienDiagramm(doc, verlaufsdaten, wertSchluessel, x, y, width, height, farbe, einheit, zeigeLabels = true) {
  const werte = verlaufsdaten.map(d => d[wertSchluessel]);
  const minWert = Math.min(...werte) * 0.95;
  const maxWert = Math.max(...werte) * 1.05;
  const n = verlaufsdaten.length;
  const stepX = width / (n - 1);
  const punktX = (i) => x + i * stepX;
  const punktY = (wert) => y + height - ((wert - minWert) / (maxWert - minWert)) * height;

  // Fläche unter der Linie (dezent)
  doc.moveTo(punktX(0), y + height);
  verlaufsdaten.forEach((d, i) => doc.lineTo(punktX(i), punktY(d[wertSchluessel])));
  doc.lineTo(punktX(n - 1), y + height).closePath().fill(LIGHT);

  doc.strokeColor(farbe).lineWidth(2);
  verlaufsdaten.forEach((d, i) => {
    const px = punktX(i), py = punktY(d[wertSchluessel]);
    if (i === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
  });
  doc.stroke();

  verlaufsdaten.forEach((d, i) => {
    const px = punktX(i), py = punktY(d[wertSchluessel]);
    doc.circle(px, py, 2).fill(farbe);
    if (zeigeLabels && (i % 2 === 0 || i === n - 1)) {
      doc.fillColor(MUTED).fontSize(6.5).font('Helvetica')
        .text(String(d.jahr), px - 10, y + height + 4, { width: 20, align: 'center' });
    }
  });

  const letzterPx = punktX(n - 1), letzterPy = punktY(werte[n - 1]);
  doc.circle(letzterPx, letzterPy, 4).fill(farbe);

  return y + height + (zeigeLabels ? 16 : 0);
}

function erstellePDF(daten, analyse) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PW = doc.page.width;
      const M = 40;

      // ── HEADER ────────────────────────────────────────────────
      doc.rect(0, 0, PW, 62).fill(NIGHT);
      zeichneLogo(doc, M, 20, true);
      doc.fillColor(WHITE).fontSize(10).font('Helvetica-Bold')
        .text('IMMOBILIENBEWERTUNG', PW - M - 220, 19, { width: 220, align: 'right' });
      doc.fillColor(TRACK).fontSize(8.5).font('Helvetica')
        .text(`Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`, PW - M - 220, 34, { width: 220, align: 'right' });

      let y = 84;

      // ── TITEL + INTRO ─────────────────────────────────────────
      doc.fillColor(NIGHT).fontSize(19).font('Helvetica-Bold')
        .text('Ihre Immobilienbewertung im Überblick', M, y, { width: PW - 2 * M });
      y = doc.y + 8;
      doc.fillColor('#444444').fontSize(9.5).font('Helvetica')
        .text(
          `Vielen Dank für Ihr Vertrauen in ImmoWertChecker. Auf Basis der von ${daten.vorname || 'Ihnen'} übermittelten ` +
          `Daten und unserer KI-gestützten Analyse haben wir den aktuellen Marktwert Ihrer Immobilie ermittelt.`,
          M, y, { width: PW - 2 * M, lineGap: 2 }
        );
      y = doc.y + 20;

      // ── OBJEKTDATEN (dunkle Box, links) + KARTE (rechts) ───────
      const linksBreite = 380, rechtsBreite = PW - 2 * M - linksBreite - 20;
      const objektH = 175;

      doc.roundedRect(M, y, linksBreite, objektH, 8).fill(NIGHT);
      doc.fillColor(CYAN).fontSize(9).font('Helvetica-Bold').text('OBJEKTDATEN', M + 20, y + 18);
      const kY = y + 42, kW = (linksBreite - 40) / 2;
      objektKachel(doc, M + 20, kY, kW, 'Objekttyp', daten.typ || '–');
      objektKachel(doc, M + 20 + kW, kY, kW, 'Grundstücksfläche', daten.grundstueck ? `${daten.grundstueck} m²` : '–');
      objektKachel(doc, M + 20, kY + 44, kW, 'Baujahr', daten.baujahr || '–');
      objektKachel(doc, M + 20 + kW, kY + 44, kW, 'Zustand', daten.zustand || '–');
      objektKachel(doc, M + 20, kY + 88, kW, 'Wohnfläche', `${daten.wohnflaeche} m²`);
      objektKachel(doc, M + 20 + kW, kY + 88, kW, 'Energieausweis', daten.energieeffizienz ? `Klasse ${daten.energieeffizienz}` : '–');

      const karteX = M + linksBreite + 20;
      const adresse = [daten.strasse, daten.hausnummer, daten.plz, daten.ort].filter(Boolean).join(' ');
      let kartenBild = null;
      try {
        kartenBild = await holeKartenausschnitt(adresse || daten.ort, rechtsBreite * 2, objektH * 2);
      } catch (e) {
        console.error('[Tim] Kartenausschnitt nicht verfügbar:', e.message);
      }
      doc.save();
      doc.roundedRect(karteX, y, rechtsBreite, objektH, 8).clip();
      try {
        if (kartenBild) doc.image(kartenBild, karteX, y, { width: rechtsBreite, height: objektH });
        else doc.image(HAUS_FOTO, karteX, y, { width: rechtsBreite, height: objektH });
      } catch (e) { /* still fine, box stays empty */ }
      doc.restore();
      doc.roundedRect(karteX, y, rechtsBreite, objektH, 8).strokeColor(TRACK).lineWidth(1).stroke();

      // Adresskarte über der Karte (unten)
      const adrKartenH = 46, adrKartenY = y + objektH - adrKartenH - 12;
      doc.roundedRect(karteX + 12, adrKartenY, rechtsBreite - 24, adrKartenH, 6).fill(WHITE);
      doc.circle(karteX + 30, adrKartenY + 15, 4).fill(PETROL);
      doc.fillColor(NIGHT).fontSize(9.5).font('Helvetica-Bold')
        .text([daten.strasse, daten.hausnummer].filter(Boolean).join(' ') || (daten.ort || '–'), karteX + 44, adrKartenY + 8, { width: rechtsBreite - 60 });
      doc.fillColor(MUTED).fontSize(8).font('Helvetica')
        .text(daten.typ || '', karteX + 44, adrKartenY + 22, { width: rechtsBreite - 60 });

      y += objektH + 20;

      // ── GESCHÄTZTER MARKTWERT (volle Breite, dunkel) ───────────
      const mwBreite = PW - 2 * M;
      const mwH = 195;
      doc.roundedRect(M, y, mwBreite, mwH, 8).fill(NIGHT);
      doc.fillColor(CYAN).fontSize(9).font('Helvetica-Bold').text('GESCHÄTZTER MARKTWERT', M + 20, y + 18);
      doc.fillColor(TRACK).fontSize(9).font('Helvetica').text('Der ermittelte Marktwert Ihrer Immobilie liegt bei:', M + 20, y + 34);

      const seitenpanelBreite = 240, chartBreite = mwBreite - seitenpanelBreite - 60;
      zeichneHistogramm(doc, M + 20, y + 56, chartBreite, 44);
      const preisY = y + 118;
      zeichnePreisstrahlDunkel(doc, analyse.wert.low, analyse.wert.high, analyse.wert.avg, M + 20, preisY, chartBreite);

      const labelY = preisY + 16;
      doc.fillColor(TRACK).fontSize(8).font('Helvetica').text('Unterer Marktwert', M + 20, labelY, { width: chartBreite / 3 });
      doc.fillColor(CYAN).fontSize(8).font('Helvetica-Bold').text('Geschätzter Marktwert', M + 20 + chartBreite / 3, labelY, { width: chartBreite / 3, align: 'center' });
      doc.fillColor(TRACK).font('Helvetica').text('Oberer Marktwert', M + 20 + chartBreite * 2 / 3, labelY, { width: chartBreite / 3, align: 'right' });

      doc.fillColor(WHITE).fontSize(13).font('Helvetica-Bold').text(fmt(analyse.wert.low), M + 20, labelY + 12, { width: chartBreite / 3 });
      doc.fillColor(CYAN).fontSize(15).text(fmt(analyse.wert.avg), M + 20 + chartBreite / 3, labelY + 12, { width: chartBreite / 3, align: 'center' });
      doc.fillColor(WHITE).fontSize(13).text(fmt(analyse.wert.high), M + 20 + chartBreite * 2 / 3, labelY + 12, { width: chartBreite / 3, align: 'right' });

      // Seitenpanel: "Wie wird der Wert ermittelt?"
      const panelX = M + 20 + chartBreite + 40;
      doc.roundedRect(panelX, y + 18, seitenpanelBreite - 20, mwH - 36, 6).fill(NIGHT2);
      doc.circle(panelX + 24, y + 40, 11).strokeColor(CYAN).lineWidth(1.2).stroke();
      doc.fillColor(CYAN).fontSize(8).font('Helvetica-Bold').text('KI', panelX + 19, y + 35);
      doc.fillColor(WHITE).fontSize(9.5).font('Helvetica-Bold').text('Wie wird der Wert ermittelt?', panelX + 44, y + 32, { width: seitenpanelBreite - 84 });
      doc.fillColor(TRACK).fontSize(8).font('Helvetica').text(
        'Wir vergleichen die Angaben zu Ihrer Immobilie mit aktuellen regionalen Markt- und Mietdaten. ' +
        'KI-gestützte Auswertung berechnet daraus eine realistische Preisspanne.',
        panelX + 20, y + 58, { width: seitenpanelBreite - 40, lineGap: 2 }
      );

      y += mwH + 20;

      // ── WERTBEEINFLUSSENDE FAKTOREN + VERGLEICHSWERTE ──────────
      const spalteBreite = (PW - 2 * M - 24) / 2;
      const spalteLinksX = M, spalteRechtsX = M + spalteBreite + 24;
      const boxY = y, boxH = 180;

      doc.roundedRect(spalteLinksX, boxY, spalteBreite, boxH, 8).strokeColor(TRACK).lineWidth(1).stroke();
      doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('WERTBEEINFLUSSENDE FAKTOREN', spalteLinksX + 16, boxY + 14);
      let faktorY = boxY + 36;
      (analyse.faktoren || []).slice(0, 7).forEach(f => {
        balkenReihe(doc, spalteLinksX + 16, faktorY, spalteBreite - 32, f.name, f.pct, f.label, PETROL);
        faktorY += 20;
      });

      doc.roundedRect(spalteRechtsX, boxY, spalteBreite, boxH, 8).strokeColor(TRACK).lineWidth(1).stroke();
      doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('VERGLEICHSWERTE IN IHRER REGION', spalteRechtsX + 16, boxY + 14);
      const typKurz = (daten.typ || '').toLowerCase().includes('wohnung') ? 'Wohnung' : 'Haus';
      const basisProQm = analyse.wert.avg / daten.wohnflaeche;
      const vergleichsdaten = [
        [`${typKurz} (neu)`, Math.round(basisProQm * 1.2), Math.round(daten.wohnflaeche * basisProQm * 1.2 * 0.9), Math.round(daten.wohnflaeche * basisProQm * 1.2 * 1.1)],
        [`${typKurz} (Ihr Objekt)`, Math.round(basisProQm), analyse.wert.low, analyse.wert.high],
        [`${typKurz} (renovierungsbed.)`, Math.round(basisProQm * 0.75), Math.round(daten.wohnflaeche * basisProQm * 0.75 * 0.9), Math.round(daten.wohnflaeche * basisProQm * 0.75 * 1.1)]
      ];
      let tabY = boxY + 36;
      doc.fillColor(MUTED).fontSize(7.5).font('Helvetica-Bold')
        .text('OBJEKTTYP', spalteRechtsX + 16, tabY, { width: spalteBreite * 0.4 })
        .text('Ø PREIS/M²', spalteRechtsX + spalteBreite * 0.5, tabY, { width: spalteBreite * 0.24, align: 'right' })
        .text('PREISBEREICH', spalteRechtsX + spalteBreite * 0.7, tabY, { width: spalteBreite * 0.28, align: 'right' });
      tabY += 16;
      doc.moveTo(spalteRechtsX + 16, tabY).lineTo(spalteRechtsX + spalteBreite - 16, tabY).strokeColor(TRACK).lineWidth(1).stroke();
      tabY += 8;
      vergleichsdaten.forEach(([label, proqm, von, bis]) => {
        const istIhres = label.includes('Ihr Objekt');
        if (istIhres) doc.rect(spalteRechtsX, tabY - 4, spalteBreite, 26).fill(LIGHT);
        doc.fillColor(istIhres ? PETROL : NIGHT).fontSize(8).font(istIhres ? 'Helvetica-Bold' : 'Helvetica')
          .text(label, spalteRechtsX + 16, tabY, { width: spalteBreite * 0.4 })
          .text(`${proqm.toLocaleString('de-DE')} €`, spalteRechtsX + spalteBreite * 0.5, tabY, { width: spalteBreite * 0.24, align: 'right' })
          .text(`${von.toLocaleString('de-DE')}–${bis.toLocaleString('de-DE')}`, spalteRechtsX + spalteBreite * 0.62, tabY, { width: spalteBreite * 0.36, align: 'right' });
        tabY += 30;
      });

      y = boxY + boxH + 20;

      // ── HINWEIS ─────────────────────────────────────────────────
      const hinweisH = 62;
      doc.roundedRect(M, y, PW - 2 * M, hinweisH, 8).fillAndStroke(LIGHT, TRACK);
      doc.fillColor(PETROL).fontSize(10).font('Helvetica-Bold').text('Hinweis', M + 16, y + 12);
      doc.fillColor('#333333').fontSize(8.5).font('Helvetica').text(
        'Diese Bewertung wurde automatisiert auf Basis aktueller Marktdaten und wissenschaftlicher Verfahren erstellt. ' +
        'Sie stellt keine verbindliche Wertermittlung nach § 194 BauGB dar. Für eine rechtssichere Bewertung empfehlen ' +
        'wir eine Vor-Ort-Besichtigung durch einen Experten.',
        M + 16, y + 26, { width: PW - 2 * M - 32, lineGap: 2 }
      );
      y += hinweisH + 20;

      // ── DETAILS ZUR IMMOBILIE + MARKTSITUATION ─────────────────
      const boxY2 = y, boxH2 = 155;
      doc.roundedRect(spalteLinksX, boxY2, spalteBreite, boxH2, 8).strokeColor(TRACK).lineWidth(1).stroke();
      doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('DETAILS ZUR IMMOBILIE', spalteLinksX + 16, boxY2 + 14);
      let zeileY = boxY2 + 36;
      const details = [
        ...(daten.heizung ? [['Heizung', daten.heizung]] : []),
        ...(daten.nutzung ? [['Nutzung', daten.nutzung === 'vermietet' ? 'Vermietet' : 'Selbstnutzung']] : []),
        ...(daten.energieeffizienz ? [['Energieeffizienzklasse', daten.energieeffizienz]] : []),
        ['Merkmale', daten.merkmale && daten.merkmale.length ? daten.merkmale.join(', ') : '–']
      ];
      details.forEach(([label, wert]) => {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(label, spalteLinksX + 16, zeileY, { width: spalteBreite - 32 - 100 });
        doc.fillColor(NIGHT).font('Helvetica-Bold').text(String(wert), spalteLinksX + spalteBreite - 116, zeileY, { width: 100, align: 'right' });
        zeileY += 17;
      });

      doc.roundedRect(spalteRechtsX, boxY2, spalteBreite, boxH2, 8).strokeColor(TRACK).lineWidth(1).stroke();
      doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('MARKTSITUATION', spalteRechtsX + 16, boxY2 + 14);
      if (analyse.preisverlauf) {
        zeichneLinienDiagramm(doc, analyse.preisverlauf.slice(-6), 'preis', spalteRechtsX + 16, boxY2 + 38, spalteBreite - 32, 55, PETROL, '€/m²', false);
        const letztes = analyse.preisverlauf[analyse.preisverlauf.length - 1].preis;
        const vorletztes = analyse.preisverlauf[analyse.preisverlauf.length - 2].preis;
        const trendPct = (((letztes - vorletztes) / vorletztes) * 100).toFixed(1);
        const trendPositiv = letztes >= vorletztes;
        doc.fillColor(trendPositiv ? PETROL : '#B0413E').fontSize(10).font('Helvetica-Bold')
          .text(trendPositiv ? 'Sehr positiv' : 'Verhalten', spalteRechtsX + 16, boxY2 + 104);
        doc.fillColor(MUTED).fontSize(7.5).font('Helvetica').text('Preisentwicklung (Ø €/m²)', spalteRechtsX + 16, boxY2 + 118);
        doc.fillColor(NIGHT).fontSize(9).font('Helvetica-Bold').text(`${trendPositiv ? '+' : ''}${trendPct} %`, spalteRechtsX + 16, boxY2 + 130);
        doc.fillColor(MUTED).fontSize(7.5).font('Helvetica').text('Aktueller Richtpreis/m²', spalteRechtsX + 16, boxY2 + 144);
        doc.fillColor(NIGHT).fontSize(9).font('Helvetica-Bold').text(`${Math.round(letztes).toLocaleString('de-DE')} €`, spalteRechtsX + 100, boxY2 + 144);
      }

      y = boxY2 + boxH2 + 20;

      // ── CTA: "Was möchten Sie als Nächstes tun?" ───────────────
      const ctaH = 100;
      doc.roundedRect(M, y, PW - 2 * M, ctaH, 8).fill(NIGHT);
      doc.fillColor(WHITE).fontSize(11).font('Helvetica-Bold').text('Was möchten Sie als Nächstes tun?', M + 20, y + 16);
      doc.fillColor(TRACK).fontSize(8.5).font('Helvetica').text(
        'Lassen Sie sich unverbindlich beraten und erfahren Sie, wie Sie den bestmöglichen Preis für Ihre Immobilie erzielen.',
        M + 20, y + 32, { width: 320, lineGap: 2 }
      );
      doc.fillColor(CYAN).fontSize(9).font('Helvetica-Bold').text('Jetzt kostenloses Beratungsgespräch sichern:', M + 20, y + 60);
      doc.fillColor(WHITE).fontSize(8.5).font('Helvetica').text('[Telefonnummer einfügen]   ·   www.immowertchecker.de', M + 20, y + 74);

      const spalte3 = (PW - 2 * M - 340) / 3;
      [
        ['100 % unverbindlich', 'Ihre Anfrage ist kostenlos und verpflichtet Sie zu nichts.'],
        ['Erfahrene Immobilienberater', 'Kennen den Markt und bewerten realistisch.'],
        ['Ihre Daten sind sicher', 'Vertraulich behandelt, gemäß DSGVO.']
      ].forEach(([titel, text], i) => {
        const cx = M + 340 + i * spalte3;
        doc.circle(cx + 12, y + 26, 11).strokeColor(CYAN).lineWidth(1.2).stroke();
        doc.fillColor(CYAN).fontSize(9).font('Helvetica-Bold').text(titel, cx, y + 44, { width: spalte3 - 12 });
        doc.fillColor(TRACK).fontSize(7.5).font('Helvetica').text(text, cx, y + 58, { width: spalte3 - 12, lineGap: 1 });
      });

      y += ctaH + 16;

      // ── FUSSZEILE (zweispaltig, ohne QR) ───────────────────────
      const footerH = 70;
      doc.rect(0, doc.page.height - footerH, PW, footerH).fill(NIGHT);
      const fy = doc.page.height - footerH + 16;
      zeichneLogo(doc, M, fy, true);
      doc.fillColor(TRACK).fontSize(7.5).font('Helvetica').text('ImmoWertChecker ist ein Service der [Firmenname GmbH einfügen]', M, fy + 30);

      const kontaktX = M + 260;
      doc.fillColor(WHITE).fontSize(8.5).font('Helvetica-Bold').text('Kontakt', kontaktX, fy);
      doc.fillColor(TRACK).fontSize(8).font('Helvetica')
        .text('[Telefonnummer einfügen]', kontaktX, fy + 13)
        .text('info@immowertchecker.de', kontaktX, fy + 25)
        .text('www.immowertchecker.de', kontaktX, fy + 37);

      const adrX = PW - M - 200;
      doc.fillColor(WHITE).fontSize(8.5).font('Helvetica-Bold').text('ImmoWertChecker', adrX, fy, { width: 200, align: 'right' });
      doc.fillColor(TRACK).fontSize(8).font('Helvetica')
        .text('[Adresse einfügen]', adrX, fy + 13, { width: 200, align: 'right' });

      // ── SEITE 2: Preisentwicklung, Mietmarkt, Rechtliches ──────
      doc.addPage({ margin: 0 });
      y = 40;

      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Preisentwicklung der letzten 10 Jahre', M, y);
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(`Modellierte Entwicklung des Kaufpreis-Richtwerts (€/m²) in ${daten.ort || 'Ihrer Region'}.`, M, doc.y + 2);
      let y2 = zeichneLinienDiagramm(doc, analyse.preisverlauf, 'preis', M, doc.y + 16, PW - 2 * M, 90, PETROL, '€/m²');

      if (analyse.mietpreis) {
        doc.y = y2 + 16;
        doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Mietmarkt-Übersicht', M, doc.y);
        doc.moveDown(0.5);
        const chartX = M, chartWidth = 300, barHeight = 15, rowGap = 26;
        const maxMiete = Math.max(analyse.mietpreis, NATIONAL_DURCHSCHNITT.miete) * 1.15;
        let rowY = doc.y + 4;
        const drawBar = (label, wert, farbe) => {
          doc.fillColor(MUTED).fontSize(8.5).font('Helvetica').text(label, chartX, rowY);
          const barY = rowY + 12;
          const barWidth = Math.max(4, (wert / maxMiete) * chartWidth);
          doc.rect(chartX, barY, barWidth, barHeight).fill(farbe);
          doc.fillColor(NIGHT).fontSize(8.5).font('Helvetica-Bold').text(`${wert.toFixed(2)} €/m²`, chartX + barWidth + 8, barY + 2);
          rowY += barHeight + rowGap;
        };
        drawBar(daten.ort || 'Ihre Region', analyse.mietpreis, PETROL);
        drawBar('Bundesdurchschnitt', NATIONAL_DURCHSCHNITT.miete, TRACK);
        doc.y = rowY;

        if (analyse.istVermietet && analyse.mietverlauf) {
          doc.moveDown(0.5);
          doc.fillColor(NIGHT).fontSize(12).font('Helvetica-Bold').text('Mietpreisentwicklung der letzten 10 Jahre', M, doc.y);
          doc.moveDown(0.9);
          doc.y = zeichneLinienDiagramm(doc, analyse.mietverlauf, 'miete', M, doc.y, PW - 2 * M, 70, '#006B80', '€/m²');
        }

        if (analyse.mietpreisbremse && analyse.mietpreisbremse.greiftNicht) {
          doc.moveDown(0.5);
          doc.fillColor(PETROL).fontSize(10).font('Helvetica-Bold').text('Hinweis zur Mietpreisbremse', M, doc.y);
          doc.moveDown(0.2);
          doc.fillColor('#333333').fontSize(9).font('Helvetica').text(
            `Nach den vorliegenden Angaben greift die Mietpreisbremse (§ 556d BGB) voraussichtlich nicht ` +
            `(${analyse.mietpreisbremse.begruendung}). Eine marktübliche Miete könnte voraussichtlich verlangt werden — ` +
            `dies ist eine grobe Einschätzung, keine verbindliche Rechtsauskunft.`,
            M, doc.y, { width: PW - 2 * M, lineGap: 2 }
          );
        }
      }

      doc.moveDown(1.5);
      doc.moveTo(M, doc.y).lineTo(PW - M, doc.y).strokeColor(TRACK).lineWidth(1).stroke();
      doc.moveDown(1.2);

      doc.fillColor(NIGHT).fontSize(16).font('Helvetica-Bold').text('Urheberrecht und Haftung', M, doc.y);
      doc.moveDown(1);

      const spB2 = (PW - 2 * M - 24) / 2;
      const spLX = M, spRX = M + spB2 + 24;
      const startY2 = doc.y;

      doc.fillColor(NIGHT).fontSize(10).font('Helvetica-Bold').text('Urheberrecht', spLX, startY2, { width: spB2 });
      doc.moveTo(spLX, doc.y + 4).lineTo(spLX + spB2, doc.y + 4).strokeColor(TRACK).lineWidth(1).stroke();
      doc.moveDown(0.6);
      doc.fillColor('#333333').fontSize(8.5).font('Helvetica').text(
        'Der Inhalt dieses Dokuments unterliegt dem Urheberrecht. Veränderungen, Kürzungen, Erweiterungen und ' +
        'Ergänzungen bedürfen der vorherigen Einwilligung der [Firmenname GmbH einfügen].',
        spLX, doc.y, { width: spB2, lineGap: 2 }
      );
      doc.moveDown(0.6);
      doc.text('Datenquellen: [Quellen der verwendeten Marktdaten einfügen].', spLX, doc.y, { width: spB2, lineGap: 2 });

      doc.fillColor(NIGHT).fontSize(10).font('Helvetica-Bold').text('Haftung', spRX, startY2, { width: spB2 });
      doc.moveTo(spRX, startY2 + 13).lineTo(spRX + spB2, startY2 + 13).strokeColor(TRACK).lineWidth(1).stroke();
      doc.fillColor('#333333').fontSize(8.5).font('Helvetica').text(
        'Bei diesem Dokument handelt es sich um das Ergebnis einer automatisierten, KI-gestützten Bewertung, die ' +
        'ausschließlich auf den Angaben des Nutzers und regionalen Durchschnittswerten beruht. Das Objekt wurde nicht besichtigt.',
        spRX, startY2 + 20, { width: spB2, lineGap: 2 }
      );

      doc.rect(0, doc.page.height - 34, PW, 34).fill(PETROL);
      doc.fillColor(WHITE).fontSize(8).font('Helvetica')
        .text('Fragen zu Ihrer Bewertung? [Telefonnummer einfügen] · info@immowertchecker.de', 50, doc.page.height - 22);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { erstellePDF };
