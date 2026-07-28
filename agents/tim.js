/**
 * TIM — Dokumenten-Spezialist
 * ────────────────────────────
 * Profil: Ordentlich, detailverliebt, hat ein Auge für sauberes Layout.
 * Sorgt dafür, dass jedes PDF aussieht, als käme es von einem echten
 * Gutachterbüro.
 */

const PDFDocument = require('pdfkit');
const { fmt } = require('./clara');
const { NATIONAL_DURCHSCHNITT } = require('./regionalpreise');

const PETROL = '#0097B2';
const NIGHT  = '#0D1B2A';
const MUTED  = '#6B7A8D';
const TRACK  = '#C8E8EE';

// ── Fußzeile mit Kontaktdaten, wird auf jeder Seite unten aufgerufen ──
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

// ── Preisstrahl: Preisspanne auf einer Linie, Durchschnitt mittig markiert ──
function zeichnePreisstrahl(doc, low, high, avg, x, y, width) {
  const pctAvg = high === low ? 0.5 : (avg - low) / (high - low);
  const avgX = x + pctAvg * width;

  doc.fillColor(PETROL).fontSize(20).font('Helvetica-Bold');
  const avgLabel = `Ø ${fmt(avg)}`;
  const avgLabelWidth = doc.widthOfString(avgLabel);
  doc.text(avgLabel, avgX - avgLabelWidth / 2, y);

  const lineY = y + 32;
  doc.strokeColor(PETROL).lineWidth(4).moveTo(x, lineY).lineTo(x + width, lineY).stroke();
  doc.circle(avgX, lineY, 6).fill(NIGHT);
  doc.circle(avgX, lineY, 3).fill('#ffffff');

  doc.fillColor(MUTED).fontSize(9).font('Helvetica-Bold');
  doc.text(fmt(low), x, lineY + 10, { width: 100 });
  const highLabelWidth = doc.widthOfString(fmt(high));
  doc.text(fmt(high), x + width - highLabelWidth, lineY + 10);

  return lineY + 30;
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

function erstellePDF(daten, analyse) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── SEITE 1 ──────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 90).fill(NIGHT);
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
        .text('IMMOWERT', 50, 32, { continued: true });
      doc.fillColor(PETROL).text('CHECKER', { continued: true });
      doc.fillColor('#ffffff').font('Helvetica').fontSize(11)
        .text('   Immobilienbewertung', { continued: false });

      doc.fillColor(NIGHT).fontSize(11).font('Helvetica')
        .text(`Erstellt für ${daten.vorname} ${daten.nachname}`.trim(), 50, 110);
      doc.fillColor(MUTED).fontSize(9)
        .text(`${new Date().toLocaleDateString('de-DE')} · ${daten.typ}${daten.ort ? ' · ' + daten.ort : ''}`);

      doc.fillColor(NIGHT).fontSize(10).font('Helvetica-Bold').text('GESCHÄTZTER MARKTWERT', 50, 155);
      const nachPreisstrahl = zeichnePreisstrahl(doc, analyse.wert.low, analyse.wert.high, analyse.wert.avg, 50, 178, doc.page.width - 100);

      doc.y = nachPreisstrahl + 6;
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Einschätzung', 50, doc.y);
      doc.moveDown(0.3);
      doc.fillColor('#333333').fontSize(11).font('Helvetica')
        .text(analyse.text.einschaetzung, { lineGap: 3 });

      doc.moveDown(1);
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Was den Wert positiv beeinflusst');
      doc.moveDown(0.3);
      (analyse.text.highlights || []).forEach((h) => {
        doc.fillColor(PETROL).fontSize(11).font('Helvetica-Bold').text('✓  ', { continued: true });
        doc.fillColor('#333333').font('Helvetica').text(h);
      });

      doc.moveDown(1);
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Käuferprofil');
      doc.moveDown(0.3);
      doc.fillColor('#333333').fontSize(11).font('Helvetica').text(analyse.text.kaeuferprofil);

      zeichneFooterleiste(doc, 1, 3);

      // ── SEITE 2 ──────────────────────────────────────────────
      doc.addPage();

      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Preisentwicklung der letzten 10 Jahre', 50, 50);
      doc.fillColor(MUTED).fontSize(9).font('Helvetica')
        .text(`Modellierte Entwicklung des Kaufpreis-Richtwerts (€/m²) in ${daten.ort || 'Ihrer Region'} — keine Einzelobjekt-Historie.`, { lineGap: 2 });
      doc.moveDown(1.4);
      let y2 = zeichneLinienDiagramm(doc, analyse.preisverlauf, 'preis', 50, doc.y, doc.page.width - 100, 110, PETROL, '€/m²');

      if (analyse.mietpreis) {
        doc.y = y2 + 10;
        doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Mietmarkt-Übersicht');
        doc.moveDown(0.3);
        doc.fillColor('#333333').fontSize(10).font('Helvetica')
          .text(`Durchschnittliche Kaltmiete in ${daten.ort || 'Ihrer Region'} im Vergleich zum Bundesdurchschnitt (€/m²):`, { lineGap: 2 });
        doc.moveDown(0.6);

        const chartX = 50, chartWidth = 320, barHeight = 16, rowGap = 30;
        const maxMiete = Math.max(analyse.mietpreis, NATIONAL_DURCHSCHNITT.miete) * 1.15;
        let rowY = doc.y;

        const drawBar = (label, wert, farbe) => {
          doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(label, chartX, rowY);
          const barY = rowY + 13;
          const barWidth = Math.max(4, (wert / maxMiete) * chartWidth);
          doc.rect(chartX, barY, barWidth, barHeight).fill(farbe);
          doc.fillColor(NIGHT).fontSize(9).font('Helvetica-Bold')
            .text(`${wert.toFixed(2)} €/m²`, chartX + barWidth + 8, barY + 3);
          rowY += barHeight + rowGap;
        };

        drawBar(daten.ort || 'Ihre Region', analyse.mietpreis, PETROL);
        drawBar('Bundesdurchschnitt', NATIONAL_DURCHSCHNITT.miete, TRACK);
        doc.y = rowY;

        if (analyse.istVermietet && analyse.mietverlauf) {
          doc.moveDown(0.6);
          doc.fillColor(NIGHT).fontSize(12).font('Helvetica-Bold').text('Mietpreisentwicklung der letzten 10 Jahre');
          doc.moveDown(0.2);
          doc.fillColor(MUTED).fontSize(9).font('Helvetica')
            .text('Da die Immobilie vermietet ist, zusätzlich die modellierte Mietentwicklung (€/m² Kaltmiete):', { lineGap: 2 });
          doc.moveDown(1.2);
          doc.y = zeichneLinienDiagramm(doc, analyse.mietverlauf, 'miete', 50, doc.y, doc.page.width - 100, 90, '#006B80', '€/m²');
        }

        if (analyse.mietpreisbremse && analyse.mietpreisbremse.greiftNicht) {
          doc.moveDown(0.5);
          doc.fillColor(PETROL).fontSize(10).font('Helvetica-Bold').text('Hinweis zur Mietpreisbremse');
          doc.moveDown(0.2);
          doc.fillColor('#333333').fontSize(9.5).font('Helvetica')
            .text(
              `Nach den vorliegenden Angaben greift die Mietpreisbremse (§ 556d BGB) für diese Immobilie voraussichtlich nicht ` +
              `(${analyse.mietpreisbremse.begruendung}). Das bedeutet: Bei einer Vermietung könnte voraussichtlich eine marktübliche ` +
              `Miete verlangt werden, ohne an die ortsübliche Vergleichsmiete zzgl. 10% gebunden zu sein — was sich positiv auf die ` +
              `erzielbare Rendite und damit auf den Wert auswirken kann. Dies ist eine grobe Einschätzung anhand Ihrer Angaben, keine verbindliche Rechtsauskunft.`,
              { lineGap: 2 }
            );
        }
      }

      doc.moveDown(1.2);
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Ihre Angaben im Überblick');
      doc.moveDown(0.4);
      const rows = [
        ['Immobilientyp', daten.typ],
        ['Lage', [daten.plz, daten.ort].filter(Boolean).join(' ') || '–'],
        ['Wohnfläche', `${daten.wohnflaeche} m²`],
        ...(daten.grundstueck ? [['Grundstück', `${daten.grundstueck} m²`]] : []),
        ['Baujahr', daten.baujahr],
        ['Zustand', daten.zustand],
        ['Ausstattung', daten.ausstattung],
        ['Heizung', daten.heizung],
        ...(daten.nutzung ? [['Nutzung', daten.nutzung === 'vermietet' ? 'Vermietet' : 'Selbstnutzung']] : []),
        ['Merkmale', daten.merkmale.length ? daten.merkmale.join(', ') : '–']
      ];
      rows.forEach(([label, value]) => {
        doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(label, 50, doc.y, { continued: true, width: 150 });
        doc.fillColor(NIGHT).font('Helvetica-Bold').text(`  ${value}`);
      });

      zeichneFooterleiste(doc, 2, 3);

      // ── SEITE 3: Urheberrecht, Haftung, Notizen ──────────────
      doc.addPage();

      doc.fillColor(NIGHT).fontSize(18).font('Helvetica-Bold').text('Urheberrecht und Haftung', 50, 50);
      doc.moveDown(1.2);

      const spaltenBreite = (doc.page.width - 120) / 2;
      const spalteLinksX = 50, spalteRechtsX = 50 + spaltenBreite + 20;
      const startY = doc.y;

      doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('Urheberrecht', spalteLinksX, startY, { width: spaltenBreite });
      doc.moveTo(spalteLinksX, doc.y + 4).lineTo(spalteLinksX + spaltenBreite, doc.y + 4).strokeColor(TRACK).lineWidth(1).stroke();
      doc.moveDown(0.8);
      doc.fillColor('#333333').fontSize(9.5).font('Helvetica').text(
        'Der Inhalt dieses Dokuments unterliegt dem Urheberrecht. Veränderungen, Kürzungen, Erweiterungen und ' +
        'Ergänzungen bedürfen der vorherigen Einwilligung der [Firmenname GmbH einfügen].',
        spalteLinksX, doc.y, { width: spaltenBreite, lineGap: 2 }
      );
      doc.moveDown(0.8);
      doc.text(
        'Die geschätzte Preisspanne sowie die dargestellten Markt- und Mietdaten basieren auf öffentlich ' +
        'zugänglichen, regionalen Durchschnittswerten sowie einer KI-gestützten Auswertung der von Ihnen ' +
        'gemachten Angaben.',
        spalteLinksX, doc.y, { width: spaltenBreite, lineGap: 2 }
      );
      doc.moveDown(0.8);
      doc.text('Datenquellen: [Quellen der verwendeten Marktdaten einfügen].', spalteLinksX, doc.y, { width: spaltenBreite, lineGap: 2 });

      doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('Haftung', spalteRechtsX, startY, { width: spaltenBreite });
      doc.moveTo(spalteRechtsX, startY + 15).lineTo(spalteRechtsX + spaltenBreite, startY + 15).strokeColor(TRACK).lineWidth(1).stroke();
      let haftungY = startY + 24;
      doc.fillColor('#333333').fontSize(9.5).font('Helvetica').text(
        'Bei diesem Dokument handelt es sich um das Ergebnis einer automatisierten, KI-gestützten Bewertung, ' +
        'die ausschließlich auf den Angaben des Nutzers und regionalen Durchschnittswerten beruht. Die Angaben ' +
        'wurden nicht überprüft. Das Objekt wurde nicht besichtigt.',
        spalteRechtsX, haftungY, { width: spaltenBreite, lineGap: 2 }
      );
      doc.moveDown(0.8);
      doc.text(
        'Von der [Firmenname GmbH einfügen] kann deshalb keine Gewähr für die Richtigkeit der dargestellten ' +
        'Daten übernommen werden. Diese Bewertung ersetzt kein Gutachten eines zertifizierten Sachverständigen.',
        spalteRechtsX, doc.y, { width: spaltenBreite, lineGap: 2 }
      );

      doc.y = Math.max(doc.y, haftungY) + 30;
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(TRACK).lineWidth(1).stroke();
      doc.moveDown(1.5);

      doc.fillColor(NIGHT).fontSize(18).font('Helvetica-Bold').text('Platz für Notizen', 50, doc.y);
      doc.moveDown(1.2);
      const notizenStartY = doc.y;
      for (let i = 0; i < 9; i++) {
        const liny = notizenStartY + i * 32;
        doc.moveTo(50, liny).lineTo(doc.page.width - 50, liny).strokeColor(TRACK).lineWidth(1).stroke();
      }

      zeichneFooterleiste(doc, 3, 3);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { erstellePDF };
