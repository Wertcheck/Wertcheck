/**
 * TIM — Dokumenten-Spezialist
 * ────────────────────────────
 * Profil: Ordentlich, detailverliebt, hat ein Auge für sauberes Layout.
 * Sorgt dafür, dass jedes PDF aussieht, als käme es von einem echten
 * Gutachterbüro.
 */

const PDFDocument = require('pdfkit');
const { fmt } = require('./clara');

const PETROL = '#0097B2';
const NIGHT  = '#0D1B2A';
const MUTED  = '#6B7A8D';

function erstellePDF(daten, analyse) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header-Balken
      doc.rect(0, 0, doc.page.width, 90).fill(NIGHT);
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
        .text('IMMOWERT', 50, 32, { continued: true });
      doc.fillColor(PETROL).text('CHECKER', { continued: true });
      doc.fillColor('#ffffff').font('Helvetica').fontSize(11)
        .text('   Immobilienbewertung', { continued: false });

      doc.moveDown(3);
      doc.fillColor(NIGHT).fontSize(11).font('Helvetica')
        .text(`Erstellt für ${daten.vorname} ${daten.nachname}`.trim(), 50, 110);
      doc.fillColor(MUTED).fontSize(9)
        .text(`${new Date().toLocaleDateString('de-DE')} · ${daten.typ}${daten.ort ? ' · ' + daten.ort : ''}`);

      // Preisspanne
      doc.moveDown(1.5);
      doc.fillColor(NIGHT).fontSize(10).font('Helvetica-Bold').text('GESCHÄTZTER MARKTWERT');
      doc.moveDown(0.3);
      doc.fillColor(PETROL).fontSize(26).font('Helvetica-Bold')
        .text(`${fmt(analyse.wert.low)} – ${fmt(analyse.wert.high)}`);
      doc.fillColor(MUTED).fontSize(11).font('Helvetica')
        .text(`Durchschnitt: ${fmt(analyse.wert.avg)}`);

      // Einschätzung
      doc.moveDown(1.2);
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Einschätzung');
      doc.moveDown(0.3);
      doc.fillColor('#333333').fontSize(11).font('Helvetica')
        .text(analyse.text.einschaetzung, { lineGap: 3 });

      // Highlights
      doc.moveDown(1);
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Was den Wert positiv beeinflusst');
      doc.moveDown(0.3);
      (analyse.text.highlights || []).forEach((h) => {
        doc.fillColor(PETROL).fontSize(11).font('Helvetica-Bold').text('✓  ', { continued: true });
        doc.fillColor('#333333').font('Helvetica').text(h);
      });

      // Käuferprofil
      doc.moveDown(1);
      doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Käuferprofil');
      doc.moveDown(0.3);
      doc.fillColor('#333333').fontSize(11).font('Helvetica').text(analyse.text.kaeuferprofil);

      // Objektdaten-Tabelle
      doc.moveDown(1.5);
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
        ['Merkmale', daten.merkmale.length ? daten.merkmale.join(', ') : '–']
      ];
      rows.forEach(([label, value]) => {
        doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(label, 50, doc.y, { continued: true, width: 150 });
        doc.fillColor(NIGHT).font('Helvetica-Bold').text(`  ${value}`);
      });

      // Footer
      doc.fontSize(8).fillColor(MUTED).font('Helvetica')
        .text(
          'Diese Bewertung basiert auf den von Ihnen gemachten Angaben und allgemeinen Marktdaten. ' +
          'Sie stellt keine rechtlich verbindliche Wertermittlung dar und ersetzt kein Gutachten eines ' +
          'zertifizierten Sachverständigen.',
          50, doc.page.height - 80, { width: doc.page.width - 100 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { erstellePDF };
