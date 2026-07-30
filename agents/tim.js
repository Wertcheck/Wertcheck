/**
 * TIM — Dokumenten-Spezialist
 * ────────────────────────────
 * Profil: Ordentlich, detailverliebt, hat ein Auge für sauberes Layout.
 * Sorgt dafür, dass jedes PDF aussieht, als käme es von einem echten
 * Gutachterbüro.
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const { fmt } = require('./clara');
const { NATIONAL_DURCHSCHNITT } = require('./regionalpreise');
const { holeKartenausschnitt } = require('./kartenausschnitt');

const PETROL = '#0097B2';
const NIGHT  = '#0D1B2A';
const MUTED  = '#6B7A8D';
const TRACK  = '#C8E8EE';
const LIGHT  = '#F0F9FB';

const HAUS_FOTO = path.join(__dirname, 'haus-foto.png');

// ── Kleine Layout-Helfer ──────────────────────────────────────────
function kachel(doc, x, y, w, label, wert) {
  doc.fillColor(MUTED).fontSize(8.5).font('Helvetica-Bold').text(label.toUpperCase(), x, y, { width: w });
  doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text(wert, x, y + 12, { width: w });
}

function balkenReihe(doc, x, y, w, name, pct, label, farbe) {
  doc.fillColor(NIGHT).fontSize(9.5).font('Helvetica').text(name, x, y, { width: 110 });
  const barX = x + 115, barW = w - 115 - 75;
  doc.roundedRect(barX, y + 1, barW, 6, 3).fill(TRACK);
  doc.roundedRect(barX, y + 1, Math.max(6, barW * (pct / 100)), 6, 3).fill(farbe);
  doc.fillColor(MUTED).fontSize(8.5).font('Helvetica-Bold').text(label, barX + barW + 8, y, { width: 70 });
}

// ── Preisstrahl: Preisspanne auf einer Linie, Durchschnitt mittig markiert ──
function zeichnePreisstrahl(doc, low, high, avg, x, y, width) {
  const pctAvg = high === low ? 0.5 : (avg - low) / (high - low);
  const avgX = x + pctAvg * width;

  const lineY = y + 8;
  doc.strokeColor(PETROL).lineWidth(5).moveTo(x, lineY).lineTo(x + width, lineY).stroke();
  doc.circle(avgX, lineY, 7).fill(NIGHT);
  doc.circle(avgX, lineY, 3.5).fill('#ffffff');

  doc.fillColor(MUTED).fontSize(8.5).font('Helvetica').text('Unterer Wert', x, lineY + 16, { width: 130 });
  doc.fillColor(PETROL).fontSize(8.5).font('Helvetica-Bold').text('Ø Marktwert', x + width / 2 - 65, lineY + 16, { width: 130, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').text('Oberer Wert', x + width - 130, lineY + 16, { width: 130, align: 'right' });

  doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text(fmt(low), x, lineY + 28, { width: 130 });
  doc.fillColor(PETROL).fontSize(15).text(fmt(avg), x + width / 2 - 65, lineY + 28, { width: 130, align: 'center' });
  doc.fillColor(NIGHT).fontSize(13).text(fmt(high), x + width - 130, lineY + 28, { width: 130, align: 'right' });

  return lineY + 50;
}

// ── Generisches Liniendiagramm für Preis-/Mietverlauf ──
function zeichneLinienDiagramm(doc, verlaufsdaten, wertSchluessel, x, y, width, height, farbe, einheit) {
  const werte = verlaufsdaten.map(d => d[wertSchluessel]);
  const minWert = Math.min(...werte) * 0.95;
  const maxWert = Math.max(...werte) * 1.05;
  const n = verlaufsdaten.length;
  const stepX = width / (n - 1);

  const punktX = (i) => x + i * stepX;
  const punktY = (wert) => y + height - ((wert - minWert) / (maxWert - minWert)) * height;

  doc.strokeColor('#EEF6F8').lineWidth(0.5);
  for (let i = 0; i <= 3; i++) {
    const gy = y + (height / 3) * i;
    doc.moveTo(x, gy).lineTo(x + width, gy).stroke();
  }

  doc.strokeColor(farbe).lineWidth(2);
  verlaufsdaten.forEach((d, i) => {
    const px = punktX(i), py = punktY(d[wertSchluessel]);
    if (i === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
  });
  doc.stroke();

  verlaufsdaten.forEach((d, i) => {
    const px = punktX(i), py = punktY(d[wertSchluessel]);
    doc.circle(px, py, 2.2).fill(farbe);
    if (i % 2 === 0 || i === n - 1) {
      doc.fillColor(MUTED).fontSize(7).font('Helvetica')
        .text(String(d.jahr), px - 10, y + height + 4, { width: 20, align: 'center' });
    }
  });

  const ersterWert = verlaufsdaten[0][wertSchluessel];
  const letzterWert = verlaufsdaten[n - 1][wertSchluessel];
  doc.fillColor(NIGHT).fontSize(8).font('Helvetica-Bold')
    .text(`${ersterWert.toLocaleString('de-DE')} ${einheit}`, x, y - 12);
  const letzterLabel = `${letzterWert.toLocaleString('de-DE')} ${einheit}`;
  doc.text(letzterLabel, x + width - doc.widthOfString(letzterLabel), y - 12);

  return y + height + 22;
}

// ── Fußzeile mit Kontaktdaten ──
function zeichneFooterleiste(doc, seite, seitenGesamt) {
  const barHeight = 34;
  const barY = doc.page.height - barHeight;
  doc.rect(0, barY, doc.page.width, barHeight).fill(PETROL);
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica')
    .text(
      'Fragen zu Ihrer Bewertung? [Telefonnummer einfügen] · info@immowertchecker.de · www.immowertchecker.de',
      50, barY + 12, { width: doc.page.width - 130, align: 'left' }
    );
  doc.fontSize(8).text(`${seite}/${seitenGesamt}`, doc.page.width - 60, barY + 12, { width: 30, align: 'right' });
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
      const M = 40; // Seitenrand

      // ── HEADER ────────────────────────────────────────────────
      doc.rect(0, 0, PW, 64).fill(NIGHT);
      doc.fillColor('#ffffff').fontSize(17).font('Helvetica-Bold').text('IMMOWERT', M, 22, { continued: true });
      doc.fillColor(PETROL).text('CHECKER', { continued: false });
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
        .text('IHRE IMMOBILIENBEWERTUNG', PW - M - 220, 20, { width: 220, align: 'right' });
      doc.fillColor(TRACK).fontSize(9).font('Helvetica')
        .text(new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), PW - M - 220, 36, { width: 220, align: 'right' });

      let y = 90;

      // ── TITEL + INTRO ─────────────────────────────────────────
      doc.fillColor(NIGHT).fontSize(19).font('Helvetica-Bold')
        .text('Zusammenfassung Ihrer Immobilienbewertung', M, y, { width: PW - 2 * M - 260 });
      y = doc.y + 8;
      doc.fillColor('#444444').fontSize(9.5).font('Helvetica')
        .text(
          `Vielen Dank für die Nutzung von ImmoWertChecker. Auf Basis der von ${daten.vorname || 'Ihnen'} eingegebenen ` +
          `Daten und unserer KI-gestützten Analyse haben wir den aktuellen Marktwert Ihrer Immobilie ermittelt.`,
          M, y, { width: PW - 2 * M - 260, lineGap: 2 }
        );

      // ── OBJEKTDATEN-KACHELN (links) + FOTO (rechts) ────────────
      // kachelY hängt bewusst von der tatsächlichen Höhe des Intro-Texts ab
      // (nicht fest verdrahtet), sonst überlappt es je nach Namenslänge/Text.
      const kachelY = Math.max(doc.y + 24, 155);
      const kachelW = 190;
      kachel(doc, M, kachelY, kachelW, 'Objekttyp', daten.typ || '–');
      kachel(doc, M + kachelW, kachelY, kachelW, 'Wohnfläche', `${daten.wohnflaeche} m²`);
      kachel(doc, M, kachelY + 44, kachelW, 'Adresse', [daten.plz, daten.ort].filter(Boolean).join(' ') || '–');
      kachel(doc, M + kachelW, kachelY + 44, kachelW, 'Grundstücksfläche', daten.grundstueck ? `${daten.grundstueck} m²` : '–');
      kachel(doc, M, kachelY + 88, kachelW, 'Baujahr', daten.baujahr || '–');
      kachel(doc, M + kachelW, kachelY + 88, kachelW, 'Zustand', daten.zustand || '–');

      try {
        const adresse = [daten.strasse, daten.hausnummer, daten.plz, daten.ort].filter(Boolean).join(' ');
        const kartenBuffer = await holeKartenausschnitt(adresse, 420, 300);
        doc.image(kartenBuffer, PW - M - 210, kachelY - 8, { fit: [210, 150] });
      } catch (e) {
        console.error('[Tim] Kartenausschnitt nicht verfügbar, nutze Foto-Fallback:', e.message);
        try {
          doc.image(HAUS_FOTO, PW - M - 210, kachelY - 8, { fit: [210, 150] });
        } catch (e2) {
          console.error('[Tim] Auch Foto-Fallback fehlgeschlagen:', e2.message);
        }
      }

      y = kachelY + 150;

      // ── MARKTWERT + FAKTOREN (zweispaltig) ─────────────────────
      const spalteBreite = (PW - 2 * M - 24) / 2;
      const spalteLinksX = M, spalteRechtsX = M + spalteBreite + 24;
      const boxY = y;

      doc.roundedRect(spalteLinksX, boxY, spalteBreite, 175, 8).strokeColor(TRACK).lineWidth(1).stroke();
      doc.fillColor(NIGHT).fontSize(12).font('Helvetica-Bold').text('Geschätzter Marktwert', spalteLinksX + 16, boxY + 14);
      doc.fillColor(MUTED).fontSize(8.5).font('Helvetica').text('Der ermittelte Marktwert Ihrer Immobilie liegt bei:', spalteLinksX + 16, boxY + 32, { width: spalteBreite - 32 });
      zeichnePreisstrahl(doc, analyse.wert.low, analyse.wert.high, analyse.wert.avg, spalteLinksX + 16, boxY + 60, spalteBreite - 32);

      doc.roundedRect(spalteRechtsX, boxY, spalteBreite, 175, 8).strokeColor(TRACK).lineWidth(1).stroke();
      doc.fillColor(NIGHT).fontSize(12).font('Helvetica-Bold').text('Wertbeeinflussende Faktoren', spalteRechtsX + 16, boxY + 14);
      let faktorY = boxY + 38;
      (analyse.faktoren || []).slice(0, 7).forEach(f => {
        balkenReihe(doc, spalteRechtsX + 16, faktorY, spalteBreite - 32, f.name, f.pct, f.label, PETROL);
        faktorY += 19;
      });

      zeichneFooterleiste(doc, 1, 3);

      // ── SEITE 2: Eckdaten + Vergleichswerte + Verläufe ─────────
      doc.addPage({ margin: 0 });
      y = 40;

      const halbBreite = (PW - 2 * M - 24) / 2;
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Eckdaten Ihrer Immobilie', M, y);
      let zeileY = y + 22;
      const eckdaten = [
        ['Objekttyp', daten.typ],
        ['Adresse', [daten.plz, daten.ort].filter(Boolean).join(' ') || '–'],
        ['Baujahr', daten.baujahr],
        ['Wohnfläche', `${daten.wohnflaeche} m²`],
        ...(daten.grundstueck ? [['Grundstücksfläche', `${daten.grundstueck} m²`]] : []),
        ['Heizung', daten.heizung],
        ...(daten.energieeffizienz ? [['Energieeffizienzklasse', daten.energieeffizienz]] : []),
        ['Zustand', daten.zustand],
        ...(daten.nutzung ? [['Nutzung', daten.nutzung === 'vermietet' ? 'Vermietet' : 'Selbstnutzung']] : [])
      ];
      eckdaten.forEach(([label, wert]) => {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(label, M, zeileY, { width: halbBreite - 90, continued: false });
        doc.fillColor(NIGHT).font('Helvetica-Bold').text(String(wert), M + halbBreite - 90, zeileY, { width: 90, align: 'right' });
        zeileY += 16;
      });

      const vergX = M + halbBreite + 24;
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Vergleichswerte in Ihrer Region', vergX, y);
      const typKurz = (daten.typ || '').toLowerCase().includes('wohnung') ? 'Wohnung' : 'Haus';
      const basis = analyse.wert.avg / daten.wohnflaeche;
      const vergleichsdaten = [
        [`${typKurz} (gehoben)`, Math.round(basis * 1.2), Math.round(daten.wohnflaeche * basis * 1.2 * 0.9), Math.round(daten.wohnflaeche * basis * 1.2 * 1.1)],
        [`${typKurz} (Ihr Objekt)`, Math.round(basis), analyse.wert.low, analyse.wert.high],
        [`${typKurz} (einfach)`, Math.round(basis * 0.75), Math.round(daten.wohnflaeche * basis * 0.75 * 0.9), Math.round(daten.wohnflaeche * basis * 0.75 * 1.1)]
      ];
      let tabY = y + 24;
      doc.rect(vergX, tabY, halbBreite, 20).fill(PETROL);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
        .text('Objekttyp', vergX + 8, tabY + 6, { width: halbBreite * 0.42 })
        .text('Ø Preis/m²', vergX + halbBreite * 0.5, tabY + 6, { width: halbBreite * 0.25, align: 'right' })
        .text('Preisbereich', vergX + halbBreite * 0.72, tabY + 6, { width: halbBreite * 0.26, align: 'right' });
      tabY += 20;
      vergleichsdaten.forEach(([label, proqm, von, bis], i) => {
        const istIhres = label.includes('Ihr Objekt');
        if (istIhres) doc.rect(vergX, tabY, halbBreite, 22).fill(LIGHT);
        doc.fillColor(istIhres ? PETROL : NIGHT).fontSize(8).font(istIhres ? 'Helvetica-Bold' : 'Helvetica')
          .text(label, vergX + 8, tabY + 6, { width: halbBreite * 0.42 })
          .text(`${proqm.toLocaleString('de-DE')} €`, vergX + halbBreite * 0.5, tabY + 6, { width: halbBreite * 0.25, align: 'right' })
          .text(`${von.toLocaleString('de-DE')}–${bis.toLocaleString('de-DE')} €`, vergX + halbBreite * 0.68, tabY + 6, { width: halbBreite * 0.3, align: 'right' });
        tabY += 22;
      });

      y = Math.max(zeileY, tabY) + 24;

      // Preisentwicklung
      doc.fillColor(NIGHT).fontSize(12).font('Helvetica-Bold').text('Preisentwicklung der letzten 10 Jahre', M, y);
      doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(`Modellierte Entwicklung des Kaufpreis-Richtwerts (€/m²) in ${daten.ort || 'Ihrer Region'}.`, M, doc.y + 2);
      let y2 = zeichneLinienDiagramm(doc, analyse.preisverlauf, 'preis', M, doc.y + 16, PW - 2 * M, 80, PETROL, '€/m²');

      // Mietmarkt + ggf. Mietverlauf
      if (analyse.mietpreis) {
        doc.y = y2 + 4;
        doc.fillColor(NIGHT).fontSize(12).font('Helvetica-Bold').text('Mietmarkt-Übersicht', M, doc.y);
        doc.moveDown(0.3);
        const chartX = M, chartWidth = 260, barHeight = 13, rowGap = 22;
        const maxMiete = Math.max(analyse.mietpreis, NATIONAL_DURCHSCHNITT.miete) * 1.15;
        let rowY = doc.y + 4;
        const drawBar = (label, wert, farbe) => {
          doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(label, chartX, rowY);
          const barY = rowY + 11;
          const barWidth = Math.max(4, (wert / maxMiete) * chartWidth);
          doc.rect(chartX, barY, barWidth, barHeight).fill(farbe);
          doc.fillColor(NIGHT).fontSize(8).font('Helvetica-Bold').text(`${wert.toFixed(2)} €/m²`, chartX + barWidth + 8, barY + 2);
          rowY += barHeight + rowGap;
        };
        drawBar(daten.ort || 'Ihre Region', analyse.mietpreis, PETROL);
        drawBar('Bundesdurchschnitt', NATIONAL_DURCHSCHNITT.miete, TRACK);
        doc.y = rowY;

        if (analyse.istVermietet && analyse.mietverlauf) {
          doc.moveDown(0.4);
          doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('Mietpreisentwicklung der letzten 10 Jahre', M, doc.y);
          doc.moveDown(0.8);
          doc.y = zeichneLinienDiagramm(doc, analyse.mietverlauf, 'miete', M, doc.y, PW - 2 * M, 65, '#006B80', '€/m²');
        }

        if (analyse.mietpreisbremse && analyse.mietpreisbremse.greiftNicht) {
          doc.moveDown(0.4);
          doc.fillColor(PETROL).fontSize(9.5).font('Helvetica-Bold').text('Hinweis zur Mietpreisbremse', M, doc.y);
          doc.moveDown(0.15);
          doc.fillColor('#333333').fontSize(8.5).font('Helvetica').text(
            `Nach den vorliegenden Angaben greift die Mietpreisbremse (§ 556d BGB) voraussichtlich nicht ` +
            `(${analyse.mietpreisbremse.begruendung}). Eine marktübliche Miete könnte voraussichtlich verlangt werden — ` +
            `dies ist eine grobe Einschätzung, keine verbindliche Rechtsauskunft.`,
            M, doc.y, { width: PW - 2 * M, lineGap: 2 }
          );
        }
      }

      zeichneFooterleiste(doc, 2, 3);

      // ── SEITE 3: Hinweis + Nächste Schritte + Urheberrecht ─────
      doc.addPage({ margin: 0 });
      y = 40;

      doc.roundedRect(M, y, PW - 2 * M, 62, 8).fillAndStroke(LIGHT, TRACK);
      doc.fillColor(PETROL).fontSize(10).font('Helvetica-Bold').text('Hinweis', M + 16, y + 12);
      doc.fillColor('#333333').fontSize(8.5).font('Helvetica').text(
        'Diese Bewertung wurde automatisiert auf Basis der von Ihnen gemachten Angaben und regionaler Marktdaten erstellt. ' +
        'Sie stellt keine verbindliche Wertermittlung nach § 194 BauGB dar. Für eine rechtssichere Bewertung empfehlen wir ' +
        'eine Vor-Ort-Besichtigung durch einen Experten.',
        M + 16, y + 26, { width: PW - 2 * M - 32, lineGap: 2 }
      );
      y += 82;

      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Wie geht es jetzt weiter?', M, y);
      doc.moveDown(0.3);
      doc.fillColor('#333333').fontSize(9).font('Helvetica').text(
        'Sie möchten den genauen Wert Ihrer Immobilie erfahren oder überlegen, zu verkaufen? Unsere Partner-Immobilienberater ' +
        'in Ihrer Region beraten Sie gerne erstklassig und unverbindlich.',
        M, doc.y, { width: PW - 2 * M, lineGap: 2 }
      );

      y = doc.y + 24;
      const spalte3 = (PW - 2 * M) / 3;
      [
        ['100 % unverbindlich', 'Ihre Anfrage ist kostenlos und verpflichtet Sie zu nichts.'],
        ['Geprüfte Immobilienberater', 'Wir arbeiten nur mit erfahrenen, geprüften Partnern.'],
        ['Ihre Daten sind sicher', 'Wir behandeln Ihre Daten vertraulich und gemäß DSGVO.']
      ].forEach(([titel, text], i) => {
        const cx = M + i * spalte3;
        doc.fillColor(NIGHT).fontSize(9.5).font('Helvetica-Bold').text(titel, cx, y, { width: spalte3 - 16 });
        doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(text, cx, doc.y + 3, { width: spalte3 - 16, lineGap: 1 });
      });

      y += 80;
      doc.moveTo(M, y).lineTo(PW - M, y).strokeColor(TRACK).lineWidth(1).stroke();
      y += 24;

      doc.fillColor(NIGHT).fontSize(16).font('Helvetica-Bold').text('Urheberrecht und Haftung', M, y);
      y = doc.y + 16;

      const spaltenBreite = (PW - 2 * M - 24) / 2;
      const spalteLX = M, spalteRX = M + spaltenBreite + 24;
      const startY2 = y;

      doc.fillColor(NIGHT).fontSize(10).font('Helvetica-Bold').text('Urheberrecht', spalteLX, startY2, { width: spaltenBreite });
      doc.moveTo(spalteLX, doc.y + 4).lineTo(spalteLX + spaltenBreite, doc.y + 4).strokeColor(TRACK).lineWidth(1).stroke();
      doc.moveDown(0.6);
      doc.fillColor('#333333').fontSize(8.5).font('Helvetica').text(
        'Der Inhalt dieses Dokuments unterliegt dem Urheberrecht. Veränderungen, Kürzungen, Erweiterungen und ' +
        'Ergänzungen bedürfen der vorherigen Einwilligung der [Firmenname GmbH einfügen].',
        spalteLX, doc.y, { width: spaltenBreite, lineGap: 2 }
      );
      doc.moveDown(0.6);
      doc.text('Datenquellen: [Quellen der verwendeten Marktdaten einfügen].', spalteLX, doc.y, { width: spaltenBreite, lineGap: 2 });

      doc.fillColor(NIGHT).fontSize(10).font('Helvetica-Bold').text('Haftung', spalteRX, startY2, { width: spaltenBreite });
      doc.moveTo(spalteRX, startY2 + 13).lineTo(spalteRX + spaltenBreite, startY2 + 13).strokeColor(TRACK).lineWidth(1).stroke();
      doc.fillColor('#333333').fontSize(8.5).font('Helvetica').text(
        'Bei diesem Dokument handelt es sich um das Ergebnis einer automatisierten, KI-gestützten Bewertung, die ' +
        'ausschließlich auf den Angaben des Nutzers und regionalen Durchschnittswerten beruht. Das Objekt wurde nicht besichtigt.',
        spalteRX, startY2 + 20, { width: spaltenBreite, lineGap: 2 }
      );

      zeichneFooterleiste(doc, 3, 3);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { erstellePDF };
