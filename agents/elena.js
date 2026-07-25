/**
 * ELENA — Versand-Agentin
 * Empfängt das fertige PDF von Tim und versendet:
 * 1. PDF + Bewertung an den Kunden (via Wertermittlung1)
 * 2. Kundendaten + Kopie an Datenchecker (via Wertermittlung2)
 */

const nodemailer = require('nodemailer');

// ── SMTP VERBINDUNGEN ──────────────────────────────────────────
function transporter1() {
  return nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER_1,
      pass: process.env.SMTP_PASS_1,
    },
    tls: { ciphers: 'SSLv3' }
  });
}

function transporter2() {
  return nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER_2,
      pass: process.env.SMTP_PASS_2,
    },
    tls: { ciphers: 'SSLv3' }
  });
}

// ── VERSENDEN ──────────────────────────────────────────────────
async function versenden(kundendaten, bewertung, pdfBuffer) {
  const name = `${kundendaten.vorname} ${kundendaten.nachname}`;

  // ── E-MAIL 1: PDF AN KUNDEN ─────────────────────────────────
  const kundenMail = {
    from: '"WertCheck Immobilienbewertung" <Wertermittlung1@outlook.de>',
    to: kundendaten.email,
    subject: `Ihre Immobilienbewertung – ${kundendaten.plz} ${kundendaten.ort}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#F8F6F2;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <tr><td style="background:#0D1B2A;padding:24px 32px;">
    <span style="font-size:20px;font-weight:900;color:#fff;">WERT</span>
    <span style="font-size:20px;font-weight:900;color:#F5A623;">CHECK</span>
    <p style="color:rgba(255,255,255,0.35);font-size:10px;margin:4px 0 0;letter-spacing:0.1em;">IMMOBILIENBEWERTUNG</p>
  </td></tr>

  <tr><td style="padding:32px 32px 0;">
    <p style="font-size:15px;color:#1A2533;margin:0 0 6px;">Sehr geehrte(r) ${kundendaten.vorname} ${kundendaten.nachname},</p>
    <p style="font-size:14px;color:#6B7A8D;line-height:1.7;margin:0 0 24px;">
      Ihre persönliche Immobilienbewertung ist fertig. Im Anhang finden Sie 
      Ihr detailliertes PDF mit allen Ergebnissen.
    </p>
  </td></tr>

  <tr><td style="padding:0 32px;">
    <table width="100%" style="background:#0D1B2A;border-radius:10px;">
      <tr><td style="background:#F5A623;height:3px;border-radius:10px 10px 0 0;"></td></tr>
      <tr><td style="padding:20px 24px;">
        <p style="color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:0.16em;margin:0 0 4px;">GESCHÄTZTER MARKTWERT</p>
        <p style="color:#fff;font-size:22px;font-weight:900;margin:0 0 4px;">
          ${bewertung.wert_low.toLocaleString('de-DE')} € – ${bewertung.wert_high.toLocaleString('de-DE')} €
        </p>
        <p style="color:#F5A623;font-size:12px;margin:0;">
          Durchschnitt: <strong>${bewertung.wert_avg.toLocaleString('de-DE')} €</strong>
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 32px;">
    <p style="font-size:13px;color:#1A2533;line-height:1.7;margin:0 0 16px;">
      ${bewertung.zusammenfassung}
    </p>
    <table width="100%" style="background:#FFF8EC;border-left:3px solid #F5A623;border-radius:0 8px 8px 0;">
      <tr><td style="padding:12px 16px;">
        <p style="font-size:12px;color:#1A2533;margin:0;line-height:1.7;">
          <strong>Empfehlung:</strong> ${bewertung.handlungsempfehlung}
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#0D1B2A;padding:18px 32px;">
    <p style="color:rgba(255,255,255,0.25);font-size:10px;margin:0;line-height:1.6;">
      WertCheck · Diese Bewertung ist ein Orientierungswert · ${bewertung.datum}
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`,
    attachments: [{
      filename: `WertCheck_Bewertung_${kundendaten.plz}_${kundendaten.ort.replace(/\s/g,'_')}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  };

  // ── E-MAIL 2: KUNDENDATEN AN DATENCHECKER ───────────────────
  const internMail = {
    from: '"WertCheck System" <Wertermittlung2@outlook.de>',
    to: process.env.INTERN_EMAIL,
    subject: `🏠 Neue Bewertung – ${name} – ${kundendaten.plz} ${kundendaten.ort}`,
    html: `
<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:20px;background:#F8F6F2;font-family:Arial,sans-serif;">
<table width="580" style="background:#fff;border-radius:10px;border:1px solid #E4DDD3;overflow:hidden;">

  <tr><td style="background:#0D1B2A;padding:16px 24px;">
    <span style="color:#fff;font-weight:900;">WERT</span>
    <span style="color:#F5A623;font-weight:900;">CHECK</span>
    <span style="color:rgba(255,255,255,0.3);font-size:11px;margin-left:10px;">NEUE BEWERTUNGSANFRAGE</span>
  </td></tr>

  <tr><td style="padding:16px 24px 0;">
    <table width="100%" style="background:#0D1B2A;border-radius:8px;">
      <tr><td style="padding:14px 18px;">
        <p style="color:rgba(255,255,255,0.4);font-size:9px;letter-spacing:0.14em;margin:0 0 3px;">MARKTWERT</p>
        <p style="color:#fff;font-size:18px;font-weight:900;margin:0;">
          ${bewertung.wert_low.toLocaleString('de-DE')} € – ${bewertung.wert_high.toLocaleString('de-DE')} €
        </p>
        <p style="color:#F5A623;font-size:11px;margin:3px 0 0;">Ø ${bewertung.wert_avg.toLocaleString('de-DE')} €</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:16px 24px 0;">
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#F5A623;margin:0 0 8px;">KONTAKT</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ['Name', name],
        ['E-Mail', kundendaten.email],
        ['Telefon', kundendaten.telefon || '–'],
        ['Ziel', kundendaten.ziel || '–'],
        ['Zeitplan', kundendaten.zeitplan || '–'],
      ].map(([l,v],i) => `
      <tr style="background:${i%2===0?'#F8F6F2':'#fff'}">
        <td style="padding:6px 10px;font-size:11px;color:#6B7A8D;width:30%;font-weight:600;">${l}</td>
        <td style="padding:6px 10px;font-size:11px;color:#1A2533;font-weight:600;">${v}</td>
      </tr>`).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:12px 24px 0;">
    <p style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#F5A623;margin:0 0 8px;">OBJEKT</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ['Typ', kundendaten.typ || '–'],
        ['Ort', `${kundendaten.plz} ${kundendaten.ort}`],
        ['Wohnfläche', `${kundendaten.wohnflaeche} m²`],
        ['Grundstück', `${kundendaten.grundstueck} m²`],
        ['Baujahr', kundendaten.baujahr || '–'],
        ['Zustand', kundendaten.zustand || '–'],
        ['Ausstattung', kundendaten.ausstattung || '–'],
        ['Heizung', kundendaten.heizung || '–'],
        ['Merkmale', Array.isArray(kundendaten.merkmale) ? kundendaten.merkmale.join(', ') : (kundendaten.merkmale || '–')],
      ].map(([l,v],i) => `
      <tr style="background:${i%2===0?'#F8F6F2':'#fff'}">
        <td style="padding:6px 10px;font-size:11px;color:#6B7A8D;width:30%;font-weight:600;">${l}</td>
        <td style="padding:6px 10px;font-size:11px;color:#1A2533;">${v}</td>
      </tr>`).join('')}
    </table>
  </td></tr>

  <tr><td style="padding:16px 24px;">
    <table width="100%" style="background:#FFF8EC;border:1px solid #F5A623;border-radius:6px;">
      <tr><td style="padding:12px 14px;">
        <p style="font-size:11px;color:#1A2533;margin:0;font-weight:600;">
          ✅ PDF wurde automatisch an ${kundendaten.email} gesendet.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#F8F6F2;padding:12px 24px;border-top:1px solid #E4DDD3;">
    <p style="color:#6B7A8D;font-size:10px;margin:0;">WertCheck System · ${bewertung.datum}</p>
  </td></tr>

</table>
</body>
</html>`,
    attachments: [{
      filename: `WertCheck_Bewertung_${name.replace(/\s/g,'_')}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  };

  // ── BEIDE E-MAILS VERSENDEN ──────────────────────────────────
  await Promise.all([
    transporter1().sendMail(kundenMail),
    transporter2().sendMail(internMail),
  ]);

  console.log('📧 Elena: E-Mails versendet an', kundendaten.email, 'und', process.env.INTERN_EMAIL);
}


// ── FOLLOW-UP E-MAIL (3 Tage später) ──────────────────────────
async function sendeFollowUp(kundendaten, bewertung) {
  const followupMail = {
    from: '"ImmowertChecker" <Wertermittlung1@outlook.de>',
    to: kundendaten.email,
    subject: 'Wie war Ihre Erfahrung mit ImmowertChecker?',
    html: `
<!DOCTYPE html>
<html lang="de">
<body style="margin:0;padding:0;background:#F0F9FB;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <tr><td style="background:#0D1B2A;padding:24px 32px;">
    <span style="font-size:18px;font-weight:900;color:#fff;">Immo</span>
    <span style="font-size:18px;font-weight:900;color:#0097B2;">Wert</span>
    <span style="font-size:18px;font-weight:900;color:#fff;">Checker</span>
  </td></tr>

  <tr><td style="padding:32px 32px 0;">
    <p style="font-size:15px;color:#1A2533;margin:0 0 8px;">Hallo ${kundendaten.vorname},</p>
    <p style="font-size:14px;color:#6B7A8D;line-height:1.75;margin:0 0 24px;">
      vor ein paar Tagen haben Sie eine kostenlose Immobilienbewertung bei uns angefragt. 
      Wir hoffen, dass Ihnen das Ergebnis weitergeholfen hat!
    </p>
    <p style="font-size:14px;color:#1A2533;font-weight:600;margin:0 0 16px;">
      Wie war Ihre Erfahrung mit ImmowertChecker?
    </p>
  </td></tr>

  <!-- Sternebewertung per E-Mail -->
  <tr><td style="padding:0 32px 24px;">
    <table width="100%" style="background:#F0F9FB;border-radius:10px;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="font-size:12px;color:#6B7A8D;margin:0 0 12px;">Klicken Sie auf die passende Bewertung:</p>
        <div style="font-size:32px;letter-spacing:4px;">
          <a href="mailto:Wertermittlung1@outlook.de?subject=Bewertung: 1 Stern&body=Meine Bewertung: 1/5 Stern" style="color:#C8E8EE;text-decoration:none;">★</a>
          <a href="mailto:Wertermittlung1@outlook.de?subject=Bewertung: 2 Sterne&body=Meine Bewertung: 2/5 Sterne" style="color:#C8E8EE;text-decoration:none;">★</a>
          <a href="mailto:Wertermittlung1@outlook.de?subject=Bewertung: 3 Sterne&body=Meine Bewertung: 3/5 Sterne" style="color:#C8E8EE;text-decoration:none;">★</a>
          <a href="mailto:Wertermittlung1@outlook.de?subject=Bewertung: 4 Sterne&body=Meine Bewertung: 4/5 Sterne" style="color:#C8E8EE;text-decoration:none;">★</a>
          <a href="mailto:Wertermittlung1@outlook.de?subject=Bewertung: 5 Sterne&body=Meine Bewertung: 5/5 Sterne - Ausgezeichnet!" style="color:#C8E8EE;text-decoration:none;">★</a>
        </div>
        <p style="font-size:11px;color:#6B7A8D;margin:12px 0 0;">Ihr Feedback hilft uns besser zu werden.</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 32px 32px;">
    <table width="100%" style="background:#F0F9FB;border-left:3px solid #0097B2;border-radius:0 8px 8px 0;">
      <tr><td style="padding:14px 16px;">
        <p style="font-size:12px;color:#1A2533;margin:0;line-height:1.7;">
          Möchten Sie mehr über den Wert Ihrer Immobilie erfahren? 
          Ein kostenloser Gesprächstermin mit einem Immobilienberater in Ihrer Region 
          kann Ihnen eine präzisere Einschätzung geben.
          <a href="https://immowertchecker.de" style="color:#0097B2;">Jetzt anfragen →</a>
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#0D1B2A;padding:16px 32px;">
    <p style="color:rgba(255,255,255,0.25);font-size:10px;margin:0;">
      ImmowertChecker · Sie erhalten diese E-Mail weil Sie eine Bewertung angefragt haben.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
  };

  await transporter1().sendMail(followupMail);
  console.log('📧 Elena: Follow-up E-Mail geplant für', kundendaten.email);
}

// Exportiere auch Follow-up Funktion
module.exports.sendeFollowUp = sendeFollowUp;

module.exports = { versenden, sendeFollowUp };
