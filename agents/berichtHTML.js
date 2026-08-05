/**
 * BERICHT-HTML — Erzeugt den HTML-Bewertungsbericht als String
 * ────────────────────────────────────────────────────────────
 * Dieselbe Vorlage dient zwei Zwecken:
 *   1. Als Quelle für Tim (Puppeteer rendert daraus das PDF)
 *   2. Später als Ergebnis-Seite, die der Kunde direkt im Browser sieht
 *
 * WICHTIG: Layout/CSS 1:1 aus der abgestimmten Vorlage übernommen.
 * Hier wird nur noch befüllt, nicht mehr gestaltet — Design-Änderungen
 * bitte im <style>-Block vornehmen, nicht durch neue Inline-Styles.
 */

const fmt = (n) => Math.round(n).toLocaleString('de-DE') + ' €';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const { NATIONAL_DURCHSCHNITT } = require('./regionalpreise');

// ── Kleine Bausteine, analog zu Tims bisherigen PDFKit-Helferfunktionen ──

function kachelHTML(label, wert) {
  return `
    <div class="kachel">
      <div class="dot"></div>
      <div><div class="lbl">${esc(label)}</div><div class="val">${esc(wert)}</div></div>
    </div>`;
}

function faktorRowHTML(f) {
  return `
    <div class="faktor-row">
      <span class="fname">${esc(f.name)}</span>
      <div class="faktor-track"><div class="faktor-fill" style="width:${f.pct}%"></div></div>
      <span class="flabel">${esc(f.label)}</span>
    </div>`;
}

function vglRowHTML(label, proqm, von, bis, aktiv) {
  return `
    <tr${aktiv ? ' class="active"' : ''}>
      <td>${esc(label)}</td>
      <td>${proqm.toLocaleString('de-DE')} €</td>
      <td>${von.toLocaleString('de-DE')}–${bis.toLocaleString('de-DE')}</td>
    </tr>`;
}

// Feste, dekorative Glockenkurve hinter dem Preisstrahl — wie im
// bisherigen PDFKit-Code kein echtes Datenchart, nur Stimmungsbild.
const HISTOGRAMM_WERTE = [0.3, 0.45, 0.6, 0.75, 0.9, 1, 0.95, 0.85, 0.7, 0.55, 0.4, 0.25];
function histogrammHTML() {
  return HISTOGRAMM_WERTE.map((v, i) => {
    const mitte = i >= HISTOGRAMM_WERTE.length / 2 - 2 && i <= HISTOGRAMM_WERTE.length / 2 + 1;
    return `<div class="bar${mitte ? ' mid' : ''}" style="height:${Math.round(v * 100)}%"></div>`;
  }).join('');
}

// Wandelt eine Verlaufsreihe ([{jahr,preis|miete}]) in SVG-Polyline-Punkte um
function linienChartHTML(verlaufsdaten, wertSchluessel, farbe, viewBoxW, viewBoxH, zeigeJahre = true) {
  const werte = verlaufsdaten.map(d => d[wertSchluessel]);
  const min = Math.min(...werte) * 0.95;
  const max = Math.max(...werte) * 1.05;
  const n = verlaufsdaten.length;
  const stepX = viewBoxW / (n - 1);
  const px = (i) => Math.round(i * stepX);
  const py = (w) => Math.round(viewBoxH - ((w - min) / (max - min)) * viewBoxH);

  const punkte = verlaufsdaten.map((d, i) => `${px(i)},${py(d[wertSchluessel])}`).join(' ');
  const kreise = verlaufsdaten.map((d, i) =>
    `<circle cx="${px(i)}" cy="${py(d[wertSchluessel])}" r="${i === n - 1 ? 3.5 : 3}"/>`
  ).join('');

  const jahresLabels = zeigeJahre
    ? `<div class="chart-years">${verlaufsdaten.filter((_, i) => i % 2 === 0 || i === n - 1).map(d => `<span>${d.jahr}</span>`).join('')}</div>`
    : '';

  return `
    <svg viewBox="0 0 ${viewBoxW} ${viewBoxH}" width="100%" height="${viewBoxH}" preserveAspectRatio="none" style="overflow:visible; margin-bottom:4px;">
      <polyline fill="none" stroke="${farbe}" stroke-width="2.5" points="${punkte}"/>
      <g fill="${farbe}">${kreise}</g>
    </svg>
    ${jahresLabels}`;
}

function erstelleBerichtHTML(daten, analyse, kartenBildBase64) {
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const typKurz = (daten.typ || '').toLowerCase().includes('wohnung') ? 'Wohnung' : 'Haus';
  const basisProQm = analyse.wert.avg / daten.wohnflaeche;

  const vergleichsdaten = [
    [`${typKurz} (neu)`, Math.round(basisProQm * 1.2), Math.round(daten.wohnflaeche * basisProQm * 1.2 * 0.9), Math.round(daten.wohnflaeche * basisProQm * 1.2 * 1.1), false],
    [`${typKurz} (Ihr Objekt)`, Math.round(basisProQm), analyse.wert.low, analyse.wert.high, true],
    [`${typKurz} (renovierungsbed.)`, Math.round(basisProQm * 0.75), Math.round(daten.wohnflaeche * basisProQm * 0.75 * 0.9), Math.round(daten.wohnflaeche * basisProQm * 0.75 * 1.1), false]
  ];

  const pctAvg = analyse.wert.high === analyse.wert.low ? 50 : ((analyse.wert.avg - analyse.wert.low) / (analyse.wert.high - analyse.wert.low)) * 100;

  const mapHTML = kartenBildBase64
    ? `<img src="data:image/png;base64,${kartenBildBase64}" alt="Kartenausschnitt">`
    : `<div class="map-placeholder">Kartenausschnitt nicht verfügbar</div>`;

  const adresse = [daten.strasse, daten.hausnummer].filter(Boolean).join(' ') || daten.ort || '–';

  // Marktsituation-Trend (letzte 6 Punkte des Preisverlaufs)
  let marktsituationHTML = '';
  if (analyse.preisverlauf && analyse.preisverlauf.length >= 2) {
    const letztes = analyse.preisverlauf[analyse.preisverlauf.length - 1].preis;
    const vorletztes = analyse.preisverlauf[analyse.preisverlauf.length - 2].preis;
    const trendPct = (((letztes - vorletztes) / vorletztes) * 100).toFixed(1);
    const trendPositiv = letztes >= vorletztes;
    marktsituationHTML = `
      <div class="outline-box">
        <div class="box-label on-light">MARKTSITUATION</div>
        ${linienChartHTML(analyse.preisverlauf.slice(-6), 'preis', '#0097B2', 240, 55, false)}
        <div class="trend-badge ${trendPositiv ? 'up' : 'down'}">${trendPositiv ? 'Sehr positiv' : 'Verhalten'}</div>
        <div class="stat-mini">
          <div><span class="slbl">Preisentwicklung (Ø €/m²)</span><span class="sval">${trendPositiv ? '+' : ''}${trendPct} %</span></div>
          <div><span class="slbl">Aktueller Richtpreis/m²</span><span class="sval">${Math.round(letztes).toLocaleString('de-DE')} €</span></div>
        </div>
      </div>`;
  }

  // Mietmarkt-Bereich (nur wenn Mietpreis-Daten vorhanden), inkl. optionaler
  // Mietpreisentwicklung (nur wenn vermietet) und Mietpreisbremse-Hinweis
  let mietBereichHTML = '';
  if (analyse.mietpreis) {
    const maxMiete = Math.max(analyse.mietpreis, NATIONAL_DURCHSCHNITT.miete) * 1.15;
    mietBereichHTML = `
      <div style="margin-top:30px;">
        <h2 class="section-h">Mietmarkt-Übersicht</h2>
        <div class="miet-row" style="margin-top:16px;">
          <div class="miet-row-label"><span>${esc(daten.ort || 'Ihre Region')}</span><b>${analyse.mietpreis.toFixed(2)} €/m²</b></div>
          <div class="miet-bar-track"><div class="miet-bar-fill" style="width:${Math.round((analyse.mietpreis / maxMiete) * 100)}%; background:#0097B2;"></div></div>
        </div>
        <div class="miet-row">
          <div class="miet-row-label"><span>Bundesdurchschnitt</span><b>${NATIONAL_DURCHSCHNITT.miete.toFixed(2)} €/m²</b></div>
          <div class="miet-bar-track"><div class="miet-bar-fill" style="width:${Math.round((NATIONAL_DURCHSCHNITT.miete / maxMiete) * 100)}%; background:#C8E8EE;"></div></div>
        </div>
        ${analyse.istVermietet && analyse.mietverlauf ? `
        <h2 class="section-h" style="margin-top:24px;">Mietpreisentwicklung der letzten 10 Jahre</h2>
        ${linienChartHTML(analyse.mietverlauf, 'miete', '#006B80', 780, 70)}
        ` : ''}
        ${analyse.mietpreisbremse && analyse.mietpreisbremse.greiftNicht ? `
        <div class="hinweis-box" style="margin-top:20px;">
          <div class="ttl">Hinweis zur Mietpreisbremse</div>
          <p>Nach den vorliegenden Angaben greift die Mietpreisbremse (§ 556d BGB) voraussichtlich nicht (${esc(analyse.mietpreisbremse.begruendung)}). Eine marktübliche Miete könnte voraussichtlich verlangt werden — dies ist eine grobe Einschätzung, keine verbindliche Rechtsauskunft.</p>
        </div>` : ''}
      </div>`;
  }

  const detailsRows = [
    ...(daten.heizung ? [['Heizung', daten.heizung]] : []),
    ...(daten.nutzung ? [['Nutzung', daten.nutzung === 'vermietet' ? 'Vermietet' : 'Selbstnutzung']] : []),
    ...(daten.energieeffizienz ? [['Energieeffizienzklasse', daten.energieeffizienz]] : []),
    ['Merkmale', daten.merkmale && daten.merkmale.length ? daten.merkmale.join(', ') : '–']
  ];

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Ihre Immobilienbewertung · ImmoWertChecker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{ --night:#0D1B2A; --night2:#16283D; --petrol:#0097B2; --petrol2:#006B80; --cyan:#4DD8E8; --cream:#F0F9FB; --light:#EAF7F9; --border:#C8E8EE; --muted:#6B7A8D; --text:#1A2533; --f-head:'Montserrat',sans-serif; --f-body:'Inter',sans-serif; }
  *{box-sizing:border-box;}
  body{ margin:0; font-family:var(--f-body); color:var(--text); background:#E4EDF0; -webkit-font-smoothing:antialiased; }
  .toolbar{ position:sticky; top:0; z-index:50; background:#ffffff; border-bottom:1px solid var(--border); padding:14px 5%; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .toolbar-left{ display:flex; align-items:center; gap:10px; font-family:var(--f-head); font-weight:700; font-size:14px; color:var(--night); }
  .toolbar-actions{ display:flex; gap:10px; }
  .tb-btn{ display:inline-flex; align-items:center; gap:8px; font-family:var(--f-body); font-size:13px; font-weight:700; padding:10px 18px; border-radius:9px; border:1px solid var(--border); background:#fff; color:var(--text); text-decoration:none; cursor:pointer; transition:background .15s, border-color .15s; }
  .tb-btn:hover{ background:var(--cream); }
  .tb-btn.primary{ background:linear-gradient(135deg,var(--petrol),var(--petrol2)); color:#fff; border:none; box-shadow:0 6px 16px rgba(0,151,178,0.3); }
  .tb-btn.primary:hover{ box-shadow:0 8px 20px rgba(0,151,178,0.42); }
  .report{ max-width:860px; margin:32px auto 64px; padding:0 5%; }
  .sheet{ background:#fff; border-radius:14px; box-shadow:0 20px 50px rgba(13,27,42,0.1); padding:0 0 26px; margin-bottom:28px; overflow:hidden; }
  .sheet-body{ padding:0 40px; }
  .report-header{ background:var(--night); padding:20px 40px; margin-bottom:26px; display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:10px; }
  .report-logo{ display:flex; align-items:center; gap:9px; }
  .report-logo svg{ flex-shrink:0; }
  .report-logo b{ font-family:var(--f-head); font-weight:800; font-size:16px; color:#fff; letter-spacing:-0.01em; }
  .report-logo b span{ color:var(--petrol); }
  .report-meta{ text-align:right; }
  .report-meta .ttl{ color:#fff; font-size:11px; font-weight:700; letter-spacing:0.04em; }
  .report-meta .sub{ color:var(--border); font-size:9.5px; margin-top:3px; }
  h1.report-title{ font-family:var(--f-head); font-size:22px; font-weight:800; color:var(--night); margin:0 0 8px; }
  .report-intro{ font-size:11.5px; color:#444; line-height:1.7; margin:0 0 22px; max-width:640px; }
  .box-label{ font-family:var(--f-head); font-size:10px; font-weight:700; letter-spacing:0.07em; color:var(--cyan); margin-bottom:4px; }
  .box-label.on-light{ color:var(--night); }
  .top-row{ display:grid; grid-template-columns:1.5fr 1fr; gap:20px; margin-bottom:20px; }
  .objektdaten-box{ background:var(--night); border-radius:10px; padding:18px 20px; }
  .kachel-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px 12px; margin-top:14px; }
  .kachel{ display:flex; align-items:flex-start; gap:9px; }
  .kachel .dot{ width:16px; height:16px; border-radius:50%; border:1.3px solid var(--cyan); flex-shrink:0; margin-top:1px; }
  .kachel .lbl{ font-size:8px; font-weight:700; letter-spacing:0.04em; color:var(--border); text-transform:uppercase; margin-bottom:2px; }
  .kachel .val{ font-size:12px; font-weight:700; color:#fff; }
  .map-box{ position:relative; border-radius:10px; overflow:hidden; border:1px solid var(--border); min-height:198px; background:linear-gradient(135deg,#DCEEF1,#EAF7F9); }
  .map-box img{ width:100%; height:100%; object-fit:cover; display:block; }
  .map-box .map-placeholder{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:11px; text-align:center; padding:20px; }
  .map-addr-card{ position:absolute; left:12px; right:12px; bottom:12px; background:#fff; border-radius:7px; padding:9px 12px; display:flex; align-items:center; gap:10px; box-shadow:0 6px 16px rgba(13,27,42,0.18); }
  .map-addr-card .pin{ width:9px; height:9px; border-radius:50%; background:var(--petrol); flex-shrink:0; }
  .map-addr-card .street{ font-size:11px; font-weight:700; color:var(--night); }
  .map-addr-card .typ{ font-size:9.5px; color:var(--muted); }
  .marktwert-box{ background:var(--night); border-radius:10px; padding:20px; margin-bottom:20px; display:grid; grid-template-columns:1fr 210px; gap:30px; align-items:start; }
  .marktwert-sub{ font-size:10.5px; color:var(--border); margin-bottom:16px; }
  .histogram{ display:flex; align-items:flex-end; gap:4px; height:48px; margin-bottom:14px; }
  .histogram .bar{ flex:1; border-radius:2px 2px 0 0; background:rgba(255,255,255,0.15); }
  .histogram .bar.mid{ background:var(--petrol); }
  .preisstrahl-track{ position:relative; height:3px; background:rgba(255,255,255,0.25); border-radius:99px; margin-bottom:14px; }
  .preisstrahl-track .end{ position:absolute; top:50%; width:8px; height:8px; border-radius:50%; background:#fff; transform:translateY(-50%); }
  .preisstrahl-track .end.l{ left:-4px; } .preisstrahl-track .end.r{ right:-4px; }
  .preisstrahl-track .dot{ position:absolute; top:50%; transform:translate(-50%,-50%); width:15px; height:15px; border-radius:50%; background:#fff; display:flex; align-items:center; justify-content:center; }
  .preisstrahl-track .dot::after{ content:''; width:7px; height:7px; border-radius:50%; background:var(--petrol); }
  .preisstrahl-labels{ display:flex; justify-content:space-between; }
  .preisstrahl-labels .l1{ font-size:9px; color:var(--border); }
  .preisstrahl-labels .l1.mid{ color:var(--cyan); font-weight:700; text-align:center; flex:1; }
  .preisstrahl-vals{ display:flex; justify-content:space-between; margin-top:5px; }
  .preisstrahl-vals span{ font-family:var(--f-head); font-weight:700; font-size:16px; color:#fff; flex:1; }
  .preisstrahl-vals span.mid{ color:var(--cyan); font-size:19px; text-align:center; }
  .preisstrahl-vals span.r{ text-align:right; }
  .ki-panel{ background:var(--night2); border-radius:8px; padding:16px; }
  .ki-panel-head{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
  .ki-badge{ width:24px; height:24px; border-radius:50%; border:1.2px solid var(--cyan); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; color:var(--cyan); flex-shrink:0; }
  .ki-panel-head b{ font-size:11.5px; color:#fff; font-weight:700; }
  .ki-panel p{ font-size:9.5px; color:var(--border); line-height:1.6; margin:0; }
  .two-col{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
  .outline-box{ border:1px solid var(--border); border-radius:10px; padding:16px 18px; }
  .faktor-row{ display:flex; align-items:center; gap:10px; margin-bottom:11px; }
  .faktor-row .fname{ font-size:11px; color:var(--night); width:100px; flex-shrink:0; }
  .faktor-track{ flex:1; height:6px; background:var(--border); border-radius:99px; overflow:hidden; }
  .faktor-fill{ height:100%; background:var(--petrol); border-radius:99px; }
  .faktor-row .flabel{ font-size:9px; font-weight:700; color:var(--muted); width:64px; text-align:right; flex-shrink:0; }
  .vgl-table{ width:100%; border-collapse:collapse; margin-top:10px; }
  .vgl-table th{ font-size:8px; font-weight:700; color:var(--muted); text-align:right; padding-bottom:8px; border-bottom:1px solid var(--border); }
  .vgl-table th:first-child{ text-align:left; }
  .vgl-table td{ font-size:9.5px; padding:8px 0; color:var(--night); text-align:right; }
  .vgl-table td:first-child{ text-align:left; }
  .vgl-table tr.active td{ color:var(--petrol); font-weight:700; }
  .vgl-table tr.active{ background:var(--light); }
  .vgl-table tr.active td:first-child{ border-radius:6px 0 0 6px; padding-left:8px; }
  .vgl-table tr.active td:last-child{ border-radius:0 6px 6px 0; padding-right:8px; }
  .hinweis-box{ background:var(--light); border:1px solid var(--border); border-radius:10px; padding:14px 18px; margin-bottom:20px; }
  .hinweis-box .ttl{ font-family:var(--f-head); font-weight:700; font-size:11px; color:var(--petrol); margin-bottom:5px; }
  .hinweis-box p{ font-size:10px; color:#333; line-height:1.6; margin:0; }
  .detail-row{ display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border); }
  .detail-row:last-child{ border-bottom:none; }
  .detail-row span:first-child{ font-size:10px; color:var(--muted); }
  .detail-row span:last-child{ font-size:10px; font-weight:700; color:var(--night); }
  .trend-badge{ font-family:var(--f-head); font-weight:700; font-size:12px; }
  .trend-badge.up{ color:var(--petrol); }
  .trend-badge.down{ color:#B0413E; }
  .stat-mini{ display:flex; justify-content:space-between; margin-top:10px; }
  .stat-mini div span{ display:block; }
  .stat-mini .slbl{ font-size:8px; color:var(--muted); }
  .stat-mini .sval{ font-size:11px; font-weight:700; color:var(--night); margin-top:2px; }
  .cta-box{ background:var(--night); border-radius:10px; padding:22px; margin-bottom:0; }
  .cta-top{ display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:20px; }
  .cta-main h2{ font-family:var(--f-head); font-size:13.5px; font-weight:700; color:#fff; margin:0 0 8px; }
  .cta-main p{ font-size:9.5px; color:var(--border); line-height:1.6; margin:0 0 14px; max-width:280px; }
  .cta-main .cta-link{ font-size:10px; font-weight:700; color:var(--cyan); margin-bottom:4px; }
  .cta-main .cta-contact{ font-size:9.5px; color:#fff; }
  .cta-badge{ display:flex; flex-direction:column; gap:8px; }
  .cta-badge .ring{ width:22px; height:22px; border-radius:50%; border:1.2px solid var(--cyan); }
  .cta-badge b{ font-size:9.5px; color:var(--cyan); font-weight:700; }
  .cta-badge p{ font-size:8px; color:var(--border); line-height:1.5; margin:0; }
  .sheet-footer{ background:var(--night); padding:16px 40px; display:flex; justify-content:space-between; margin-top:26px; }
  .footer-brand p{ font-size:8px; color:var(--border); margin:6px 0 0; }
  .footer-col b{ display:block; font-size:9.5px; color:#fff; margin-bottom:6px; }
  .footer-col span{ display:block; font-size:8.5px; color:var(--border); line-height:1.6; }
  .footer-col.right{ text-align:right; }
  .footer-thin{ background:var(--petrol); padding:11px 40px; font-size:9px; color:#fff; margin-top:20px; }
  .chart-sub{ font-size:10.5px; color:var(--muted); margin:2px 0 16px; }
  h2.section-h{ font-family:var(--f-head); font-size:14.5px; font-weight:700; color:var(--night); margin:0 0 2px; }
  .chart-years{ display:flex; justify-content:space-between; font-size:8.5px; color:var(--muted); margin-top:2px; }
  .miet-row{ margin-bottom:16px; }
  .miet-row-label{ font-size:10.5px; color:var(--muted); margin-bottom:5px; display:flex; justify-content:space-between; }
  .miet-row-label b{ color:var(--night); font-family:var(--f-head); font-size:11px; }
  .miet-bar-track{ height:15px; border-radius:5px; background:var(--cream); overflow:hidden; }
  .miet-bar-fill{ height:100%; border-radius:5px; }
  .legal-grid{ display:grid; grid-template-columns:1fr 1fr; gap:36px; margin-top:8px; }
  .legal-col h3{ font-family:var(--f-head); font-size:11px; font-weight:700; color:var(--night); border-bottom:1px solid var(--border); padding-bottom:7px; margin-bottom:10px; }
  .legal-col p{ font-size:9.5px; color:#555; line-height:1.7; margin:0 0 9px; }
  @media (max-width:760px){
    .sheet-body{ padding:0 20px; } .report-header{ padding:18px 20px; flex-direction:column; } .report-meta{ text-align:left; }
    .top-row, .two-col, .cta-top{ grid-template-columns:1fr; } .marktwert-box{ grid-template-columns:1fr; }
    .legal-grid{ grid-template-columns:1fr; gap:22px; } .sheet-footer{ padding:16px 20px; flex-direction:column; gap:14px; }
    .footer-col.right{ text-align:left; } .footer-thin{ padding:11px 20px; }
  }
  @media print{
    body{ background:#fff; } .toolbar{ display:none; } .report{ max-width:none; margin:0; padding:0; }
    .sheet{ box-shadow:none; border-radius:0; margin:0; page-break-after:always; } .sheet:last-child{ page-break-after:auto; }
  }
</style>
</head>
<body>

<div class="toolbar">
  <div class="toolbar-left">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0097B2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12L12 4l9 8"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/><path d="M9 15l2 2 4-4"/></svg>
    <span>Ihre Immobilienbewertung ist fertig</span>
  </div>
  <div class="toolbar-actions">
    <a href="/" class="tb-btn">Neue Bewertung</a>
    <a href="#" class="tb-btn primary" onclick="window.print(); return false;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3a1 1 0 001 1h14a1 1 0 001-1v-3"/></svg>
      Als PDF speichern
    </a>
  </div>
</div>

<div class="report">
  <div class="sheet">
    <div class="report-header">
      <div class="report-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4DD8E8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12L12 4l9 8"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/><path d="M9 15l2 2 4-4"/></svg>
        <b>IMMOWERT<span>CHECKER</span></b>
      </div>
      <div class="report-meta">
        <div class="ttl">IMMOBILIENBEWERTUNG</div>
        <div class="sub">Erstellt am ${heute}</div>
      </div>
    </div>

    <div class="sheet-body">
      <h1 class="report-title">Ihre Immobilienbewertung im Überblick</h1>
      <p class="report-intro">Vielen Dank für Ihr Vertrauen in ImmoWertChecker. Auf Basis der von ${esc(daten.vorname || 'Ihnen')} übermittelten Daten und unserer KI-gestützten Analyse haben wir den aktuellen Marktwert Ihrer Immobilie ermittelt.</p>

      <div class="top-row">
        <div class="objektdaten-box">
          <div class="box-label">OBJEKTDATEN</div>
          <div class="kachel-grid">
            ${kachelHTML('Objekttyp', daten.typ || '–')}
            ${kachelHTML('Grundstücksfläche', daten.grundstueck ? `${daten.grundstueck} m²` : '–')}
            ${kachelHTML('Baujahr', daten.baujahr || '–')}
            ${kachelHTML('Zustand', daten.zustand || '–')}
            ${kachelHTML('Wohnfläche', `${daten.wohnflaeche} m²`)}
            ${kachelHTML('Energieausweis', daten.energieeffizienz ? `Klasse ${daten.energieeffizienz}` : '–')}
          </div>
        </div>
        <div class="map-box">
          ${mapHTML}
          <div class="map-addr-card">
            <div class="pin"></div>
            <div><div class="street">${esc(adresse)}</div><div class="typ">${esc(daten.typ || '')}</div></div>
          </div>
        </div>
      </div>

      <div class="marktwert-box">
        <div>
          <div class="box-label">GESCHÄTZTER MARKTWERT</div>
          <div class="marktwert-sub">Der ermittelte Marktwert Ihrer Immobilie liegt bei:</div>
          <div class="histogram">${histogrammHTML()}</div>
          <div class="preisstrahl-track">
            <div class="end l"></div><div class="end r"></div>
            <div class="dot" style="left:${pctAvg}%"></div>
          </div>
          <div class="preisstrahl-labels">
            <span class="l1">Unterer Marktwert</span><span class="l1 mid">Geschätzter Marktwert</span><span class="l1" style="text-align:right; flex:1;">Oberer Marktwert</span>
          </div>
          <div class="preisstrahl-vals">
            <span>${fmt(analyse.wert.low)}</span><span class="mid">${fmt(analyse.wert.avg)}</span><span class="r">${fmt(analyse.wert.high)}</span>
          </div>
        </div>
        <div class="ki-panel">
          <div class="ki-panel-head"><div class="ki-badge">KI</div><b>Wie wird der Wert ermittelt?</b></div>
          <p>Wir vergleichen die Angaben zu Ihrer Immobilie mit aktuellen regionalen Markt- und Mietdaten. KI-gestützte Auswertung berechnet daraus eine realistische Preisspanne.</p>
        </div>
      </div>

      <div class="two-col">
        <div class="outline-box">
          <div class="box-label on-light">WERTBEEINFLUSSENDE FAKTOREN</div>
          <div style="margin-top:14px;">${(analyse.faktoren || []).slice(0, 7).map(faktorRowHTML).join('')}</div>
        </div>
        <div class="outline-box">
          <div class="box-label on-light">VERGLEICHSWERTE IN IHRER REGION</div>
          <table class="vgl-table">
            <tr><th>Objekttyp</th><th>Ø Preis/m²</th><th>Preisbereich</th></tr>
            ${vergleichsdaten.map(([l, p, v, b, a]) => vglRowHTML(l, p, v, b, a)).join('')}
          </table>
        </div>
      </div>

      <div class="hinweis-box">
        <div class="ttl">Hinweis</div>
        <p>Diese Bewertung wurde automatisiert auf Basis aktueller Marktdaten und wissenschaftlicher Verfahren erstellt. Sie stellt keine verbindliche Wertermittlung nach § 194 BauGB dar. Für eine rechtssichere Bewertung empfehlen wir eine Vor-Ort-Besichtigung durch einen Experten.</p>
      </div>

      <div class="two-col">
        <div class="outline-box">
          <div class="box-label on-light">DETAILS ZUR IMMOBILIE</div>
          <div style="margin-top:12px;">
            ${detailsRows.map(([l, w]) => `<div class="detail-row"><span>${esc(l)}</span><span>${esc(w)}</span></div>`).join('')}
          </div>
        </div>
        ${marktsituationHTML}
      </div>

      <div class="cta-box">
        <div class="cta-top">
          <div class="cta-main" style="grid-column:span 2;">
            <h2>Was möchten Sie als Nächstes tun?</h2>
            <p>Lassen Sie sich unverbindlich beraten und erfahren Sie, wie Sie den bestmöglichen Preis für Ihre Immobilie erzielen.</p>
            <div class="cta-link">Jetzt kostenloses Beratungsgespräch sichern:</div>
            <div class="cta-contact">[Telefonnummer einfügen] · www.immowertchecker.de</div>
          </div>
          <div class="cta-badge"><div class="ring"></div><b>100 % unverbindlich</b><p>Ihre Anfrage ist kostenlos und verpflichtet Sie zu nichts.</p></div>
          <div class="cta-badge"><div class="ring"></div><b>Erfahrene Immobilienberater</b><p>Kennen den Markt und bewerten realistisch.</p></div>
        </div>
      </div>
    </div>

    <div class="sheet-footer">
      <div class="footer-brand">
        <div class="report-logo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4DD8E8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12L12 4l9 8"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg><b style="font-size:14px;">IMMOWERT<span>CHECKER</span></b></div>
        <p>ImmoWertChecker ist ein Service der [Firmenname GmbH einfügen]</p>
      </div>
      <div class="footer-col">
        <b>Kontakt</b>
        <span>[Telefonnummer einfügen]</span>
        <span>info@immowertchecker.de</span>
        <span>www.immowertchecker.de</span>
      </div>
      <div class="footer-col right">
        <b>ImmoWertChecker</b>
        <span>[Adresse einfügen]</span>
      </div>
    </div>
  </div>

  <div class="sheet">
    <div class="sheet-body" style="padding-top:36px;">
      <h2 class="section-h">Preisentwicklung der letzten 10 Jahre</h2>
      <p class="chart-sub">Modellierte Entwicklung des Kaufpreis-Richtwerts (€/m²) in ${esc(daten.ort || 'Ihrer Region')}.</p>
      ${linienChartHTML(analyse.preisverlauf, 'preis', '#0097B2', 780, 100)}

      ${mietBereichHTML}

      <hr style="border:none; border-top:1px solid var(--border); margin:32px 0;">

      <h2 class="section-h" style="font-size:18px;">Urheberrecht und Haftung</h2>
      <div class="legal-grid">
        <div class="legal-col">
          <h3>Urheberrecht</h3>
          <p>Der Inhalt dieses Dokuments unterliegt dem Urheberrecht. Veränderungen, Kürzungen, Erweiterungen und Ergänzungen bedürfen der vorherigen Einwilligung der [Firmenname GmbH einfügen].</p>
          <p>Datenquellen: [Quellen der verwendeten Marktdaten einfügen].</p>
        </div>
        <div class="legal-col">
          <h3>Haftung</h3>
          <p>Bei diesem Dokument handelt es sich um das Ergebnis einer automatisierten, KI-gestützten Bewertung, die ausschließlich auf den Angaben des Nutzers und regionalen Durchschnittswerten beruht. Das Objekt wurde nicht besichtigt.</p>
        </div>
      </div>
    </div>
    <div class="footer-thin">Fragen zu Ihrer Bewertung? [Telefonnummer einfügen] · info@immowertchecker.de</div>
  </div>
</div>

</body>
</html>`;
}

module.exports = { erstelleBerichtHTML };
