/**
 * TIM — PDF-Agent
 * Empfängt die Bewertungsdaten von Clara und erstellt
 * daraus ein professionelles PDF für den Kunden.
 */

const PDFDocument = require('pdfkit');

// Farben
const NIGHT  = '#0D1B2A';
const ORANGE = '#F5A623';
const MUTED  = '#6B7A8D';
const TEXT   = '#1A2533';
const CREAM  = '#F8F6F2';
const WHITE  = '#FFFFFF';
const GREEN  = '#2A7A4B';
const RED    = '#C0392B';

async function erstellePDF(kundendaten, bewertung) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const ML = 45;
    const MR = 45;
    const CW = W - ML - MR;

    // ── SEITE 1: DECKBLATT ──────────────────────────────────────
    // Hintergrund
    doc.rect(0, 0, W, H).fill(NIGHT);

    // Orange Top Bar
    doc.rect(0, 0, W, 3).fill(ORANGE);

    // Header
    doc.rect(0, 3, W, 55).fill('#0F2236');

    // WERTCHECK Logo Text
    doc.font('Helvetica-Bold').fontSize(16).fill(WHITE)
       .text('WERT', ML, 20, { continued: true });
    doc.fill(ORANGE).text('CHECK');

    doc.font('Helvetica').fontSize(8).fill('#4A6080')
       .text('IMMOBILIENBEWERTUNG', ML, 38);

    doc.font('Helvetica').fontSize(8).fill('#4A6080')
       .text(bewertung.datum, { align: 'right' }, 38);

    // Adresse
    doc.rect(0, 75, W, 1).fill('#1E3050');

    doc.font('Helvetica').fontSize(8).fill('#4A6080')
       .text('BEWERTUNGSOBJEKT', ML, 90);

    doc.rect(ML, 102, 3, 20).fill(ORANGE);

    doc.font('Helvetica-Bold').fontSize(22).fill(WHITE)
       .text(`${kundendaten.plz} ${kundendaten.ort}`, ML + 8, 103);

    doc.font('Helvetica').fontSize(12).fill('#8A9BAA')
       .text(kundendaten.typ || 'Immobilie', ML + 8, 126);

    // Divider
    doc.rect(0, 145, W, 1).fill('#1E3050');

    // PREIS — Zentrum
    doc.font('Helvetica').fontSize(9).fill('#4A6080')
       .text('GESCHÄTZTER MARKTWERT', 0, 158, { align: 'center' });

    doc.rect(W/2 - 40, 170, 80, 1).fill(ORANGE);

    doc.font('Helvetica-Bold').fontSize(28).fill(WHITE)
       .text(
         `${bewertung.wert_low.toLocaleString('de-DE')} € – ${bewertung.wert_high.toLocaleString('de-DE')} €`,
         0, 178, { align: 'center' }
       );

    doc.font('Helvetica').fontSize(12).fill(ORANGE)
       .text(`Durchschnitt  ${bewertung.wert_avg.toLocaleString('de-DE')} €`, 0, 215, { align: 'center' });

    doc.font('Helvetica').fontSize(9).fill('#4A6080')
       .text(`${bewertung.qm_preis.toLocaleString('de-DE')} €/m²  ·  Wohnfläche ${kundendaten.wohnflaeche} m²`, 0, 232, { align: 'center' });

    // 4 KPI Boxen
    const kpis = [
      ['PREISTREND', '+4,2 % p.a.', 'München'],
      ['PREIS/M²', `${bewertung.qm_preis.toLocaleString('de-DE')} €`, 'Ihr Objekt'],
      ['NACHFRAGE', 'Sehr hoch', 'Aktuell'],
      ['VERKAUF IN', '3–5 Wochen', 'Erwartet'],
    ];
    const kpiW = (CW - 9) / 4;
    kpis.forEach(([label, value, sub], i) => {
      const bx = ML + i * (kpiW + 3);
      const by = 255;
      doc.rect(bx, by, kpiW, 40).fill('#0F2236');
      doc.rect(bx, by, kpiW, 1.5).fill(ORANGE);
      doc.font('Helvetica').fontSize(6).fill('#4A6080')
         .text(label, bx + 6, by + 6, { width: kpiW - 12 });
      doc.font('Helvetica-Bold').fontSize(10).fill(WHITE)
         .text(value, bx + 6, by + 17, { width: kpiW - 12 });
      doc.font('Helvetica').fontSize(6).fill('#4A6080')
         .text(sub, bx + 6, by + 30, { width: kpiW - 12 });
    });

    // Divider
    doc.rect(0, 306, W, 1).fill('#1E3050');

    // Objektdetails Grid
    doc.font('Helvetica').fontSize(7).fill('#4A6080')
       .text('OBJEKTDETAILS', ML, 315);

    const details = [
      ['Baujahr', kundendaten.baujahr || '–'],
      ['Wohnfläche', `${kundendaten.wohnflaeche} m²`],
      ['Grundstück', `${kundendaten.grundstueck} m²`],
      ['Zustand', kundendaten.zustand || '–'],
      ['Ausstattung', kundendaten.ausstattung || '–'],
      ['Heizung', kundendaten.heizung || '–'],
    ];
    const detW = CW / 3;
    const detH = 22;
    details.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const dx = ML + col * detW;
      const dy = 323 + row * detH;
      const bg = (col + row) % 2 === 0 ? '#0F2236' : '#111E2E';
      doc.rect(dx, dy, detW - 2, detH - 2).fill(bg);
      doc.font('Helvetica').fontSize(6).fill('#4A6080')
         .text(label.toUpperCase(), dx + 5, dy + 4, { width: detW - 10 });
      doc.font('Helvetica-Bold').fontSize(9).fill(WHITE)
         .text(value, dx + 5, dy + 12, { width: detW - 10 });
    });

    // Divider
    doc.rect(0, 371, W, 1).fill('#1E3050');

    // Zusammenfassung
    doc.font('Helvetica').fontSize(7).fill('#4A6080')
       .text('BEWERTUNGSZUSAMMENFASSUNG', ML, 380);

    doc.font('Helvetica').fontSize(9).fill('#8A9BAA')
       .text(bewertung.zusammenfassung, ML, 393, { width: CW, lineGap: 3 });

    // Eigentümer + Ref
    const botY = H - 55;
    doc.rect(0, botY - 5, W, 1).fill('#1E3050');

    doc.font('Helvetica').fontSize(7).fill('#4A6080')
       .text('ERSTELLT FÜR', ML, botY + 3);
    doc.font('Helvetica-Bold').fontSize(9).fill(WHITE)
       .text(bewertung.kunde_name, ML, botY + 13);

    doc.font('Helvetica').fontSize(7).fill('#4A6080')
       .text('REFERENZ', W/2 - 30, botY + 3);
    doc.font('Helvetica-Bold').fontSize(9).fill(WHITE)
       .text(`WC-${Date.now().toString().slice(-8)}`, W/2 - 30, botY + 13);

    doc.font('Helvetica').fontSize(7).fill('#4A6080')
       .text('DATUM', W - MR - 60, botY + 3);
    doc.font('Helvetica-Bold').fontSize(9).fill(WHITE)
       .text(bewertung.datum, W - MR - 60, botY + 13);

    doc.rect(0, H - 3, W, 3).fill(ORANGE);

    // ── SEITE 2: ANALYSE ────────────────────────────────────────
    doc.addPage();
    doc.rect(0, 0, W, H).fill(WHITE);

    // Header
    doc.rect(0, 0, W, 52).fill(NIGHT);
    doc.rect(0, 52, W, 1.5).fill(ORANGE);
    doc.font('Helvetica-Bold').fontSize(12).fill(WHITE)
       .text('WERT', ML, 18, { continued: true });
    doc.fill(ORANGE).text('CHECK');
    doc.font('Helvetica').fontSize(8).fill('#8A9BAA')
       .text('DETAILLIERTE ANALYSE', ML + 60, 21);
    doc.font('Helvetica').fontSize(7).fill('#4A6080')
       .text(`Seite 2 von 2  ·  ${bewertung.datum}`, { align: 'right' }, 21);

    // Footer
    doc.rect(0, H - 25, W, 25).fill(CREAM);
    doc.rect(0, H - 25, W, 0.5).fill(ORANGE);
    doc.font('Helvetica').fontSize(7).fill(MUTED)
       .text('Orientierungswert · Kein verbindliches Gutachten · WertCheck Immobilienbewertung', ML, H - 16);

    let y = 75;

    // Wertboxen
    doc.font('Helvetica-Bold').fontSize(8).fill(ORANGE)
       .text('PREISSPANNE', ML, y);
    doc.rect(ML, y + 12, CW, 1).fill(ORANGE);
    y += 18;

    const boxes = [
      ['NIEDRIG', bewertung.wert_low, RED],
      ['DURCHSCHNITT', bewertung.wert_avg, NIGHT],
      ['HOCH', bewertung.wert_high, GREEN],
    ];
    const boxW = (CW - 6) / 3;
    boxes.forEach(([label, value, color], i) => {
      const bx = ML + i * (boxW + 3);
      doc.rect(bx, y, boxW, 45).fill(CREAM);
      doc.rect(bx, y, boxW, 2).fill(color);
      doc.font('Helvetica').fontSize(7).fill(MUTED)
         .text(label, bx + 8, y + 8, { width: boxW - 16 });
      doc.font('Helvetica-Bold').fontSize(13).fill(color)
         .text(`${value.toLocaleString('de-DE')} €`, bx + 8, y + 18, { width: boxW - 16 });
    });
    y += 60;

    // Analyse Sektionen
    const sektionen = [
      ['LAGEANALYSE', bewertung.lageanalyse],
      ['WERTTREIBER', bewertung.werttreiber],
      ['HANDLUNGSEMPFEHLUNG', bewertung.handlungsempfehlung],
    ];

    sektionen.forEach(([titel, text]) => {
      doc.font('Helvetica-Bold').fontSize(8).fill(ORANGE)
         .text(titel, ML, y);
      doc.rect(ML, y + 12, CW, 1).fill(ORANGE);
      y += 18;
      doc.font('Helvetica').fontSize(9.5).fill(TEXT)
         .text(text, ML, y, { width: CW, lineGap: 3 });
      y += doc.heightOfString(text, { width: CW, lineGap: 3 }) + 20;
    });

    // CTA Box
    y += 5;
    doc.rect(ML, y, CW, 60).fill(NIGHT);
    doc.rect(ML, y, CW, 2).fill(ORANGE);
    doc.font('Helvetica-Bold').fontSize(12).fill(WHITE)
       .text('Nächster Schritt', ML + 16, y + 10);
    doc.font('Helvetica').fontSize(9).fill('#8A9BAA')
       .text(
         'Vereinbaren Sie jetzt ein kostenloses Beratungsgespräch mit einem erfahrenen Immobilienberater.',
         ML + 16, y + 26, { width: CW - 32 }
       );
    doc.font('Helvetica-Bold').fontSize(9).fill(ORANGE)
       .text('wertcheck.de/beratung', ML + 16, y + 44);

    doc.end();
  });
}

module.exports = { erstellePDF };
