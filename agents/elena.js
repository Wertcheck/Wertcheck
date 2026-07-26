/**
 * ELENA — Kundenkommunikation
 * ────────────────────────────
 * Profil: Warm, zuvorkommend, verbindlich. Schreibt E-Mails, die sich
 * persönlich anfühlen statt automatisiert — freundlich, aber nie
 * aufdringlich. Versendet über die SendGrid API.
 */

const sgMail = require('@sendgrid/mail');
const { fmt } = require('./clara');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const SENDER_EMAIL   = process.env.SENDER_EMAIL   || 'bewertung@immowertchecker.de';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'info@immowertchecker.de';
const INTERN_EMAIL   = process.env.INTERN_EMAIL   || 'Datenchecker@outlook.de';

async function versende(daten, analyse, pdfBuffer) {
  const pdfBase64 = pdfBuffer.toString('base64');
  const anrede = daten.vorname && daten.vorname !== 'Kunde' ? daten.vorname : 'Sie';

  // 1) E-Mail an den Kunden
  if (daten.email) {
    const kundenMail = {
      to: daten.email,
      from: { email: SENDER_EMAIL, name: 'ImmoWertChecker' },
      replyTo: REPLY_TO_EMAIL,
      subject: `Ihre Immobilienbewertung ist da, ${anrede}!`,
      text:
        `Hallo ${anrede},\n\n` +
        `vielen Dank, dass Sie ImmoWertChecker genutzt haben. ` +
        `Ihre persönliche Bewertung finden Sie im Anhang als PDF.\n\n` +
        `Geschätzter Marktwert: ${fmt(analyse.wert.low)} – ${fmt(analyse.wert.high)}\n\n` +
        `Herzliche Grüße\nIhr ImmoWertChecker-Team`,
      html: `
        <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto; color:#0D1B2A;">
          <div style="background:#0D1B2A; padding:24px; border-radius:12px 12px 0 0;">
            <span style="color:#fff; font-size:20px; font-weight:bold;">IMMOWERT</span><span style="color:#0097B2; font-size:20px; font-weight:bold;">CHECKER</span>
          </div>
          <div style="padding:28px; border:1px solid #eee; border-top:none; border-radius:0 0 12px 12px;">
            <p>Hallo ${anrede},</p>
            <p>vielen Dank, dass Sie <strong>ImmoWertChecker</strong> genutzt haben. Ihre persönliche Bewertung finden Sie im Anhang als PDF.</p>
            <div style="background:#F0F9FB; border-radius:10px; padding:18px; margin:20px 0; text-align:center;">
              <div style="font-size:11px; color:#6B7A8D; text-transform:uppercase; letter-spacing:0.05em;">Geschätzter Marktwert</div>
              <div style="font-size:24px; font-weight:bold; color:#0097B2; margin-top:6px;">${fmt(analyse.wert.low)} – ${fmt(analyse.wert.high)}</div>
            </div>
            <p>Bei Fragen antworten Sie einfach auf diese E-Mail — wir melden uns gerne persönlich.</p>
            <p>Herzliche Grüße<br>Ihr ImmoWertChecker-Team</p>
          </div>
        </div>`,
      attachments: [{
        content: pdfBase64,
        filename: 'Immobilienbewertung.pdf',
        type: 'application/pdf',
        disposition: 'attachment'
      }]
    };

    await sgMail.send(kundenMail);
    console.log(`[Elena] Kunden-E-Mail an ${daten.email} verschickt.`);
  } else {
    console.log('[Elena] Keine Kunden-E-Mail-Adresse vorhanden — übersprungen.');
  }

  // 2) Interne Benachrichtigung
  const internMail = {
    to: INTERN_EMAIL,
    from: { email: SENDER_EMAIL, name: 'ImmoWertChecker Bot' },
    subject: `Neue Bewertung: ${daten.vorname} ${daten.nachname} – ${daten.typ} in ${daten.ort || '?'}`,
    text:
      `Neue Anfrage über den Wizard:\n\n` +
      `Name: ${daten.vorname} ${daten.nachname}\n` +
      `E-Mail: ${daten.email || '–'}\n` +
      `Telefon: ${daten.telefon || '–'}\n` +
      `Immobilie: ${daten.typ}, ${daten.wohnflaeche} m², ${daten.plz} ${daten.ort}\n` +
      `Geschätzter Wert: ${fmt(analyse.wert.low)} – ${fmt(analyse.wert.high)}\n` +
      `Ziel: ${daten.ziel} · Zeitplan: ${daten.zeitplan}\n` +
      `Bewertung durch Nutzer (Sterne): ${daten.rating || 'noch nicht abgegeben'}`,
    attachments: [{
      content: pdfBase64,
      filename: 'Immobilienbewertung.pdf',
      type: 'application/pdf',
      disposition: 'attachment'
    }]
  };

  await sgMail.send(internMail);
  console.log(`[Elena] Interne Benachrichtigung an ${INTERN_EMAIL} verschickt.`);
}

// Verschickt den 6-stelligen Bestätigungscode an den Kunden, bevor
// die eigentliche Bewertung (PDF) versendet wird.
async function sendeCode(email, vorname, code) {
  const anrede = vorname && vorname !== 'Kunde' ? vorname : 'Sie';
  const mail = {
    to: email,
    from: { email: SENDER_EMAIL, name: 'ImmoWertChecker' },
    replyTo: REPLY_TO_EMAIL,
    subject: `Ihr Bestätigungscode: ${code}`,
    text: `Hallo ${anrede},\n\nIhr Bestätigungscode lautet: ${code}\n\nDer Code ist 10 Minuten gültig.\n\nHerzliche Grüße\nIhr ImmoWertChecker-Team`,
    html: `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; color:#0D1B2A;">
        <div style="background:#0D1B2A; padding:24px; border-radius:12px 12px 0 0;">
          <span style="color:#fff; font-size:20px; font-weight:bold;">IMMOWERT</span><span style="color:#0097B2; font-size:20px; font-weight:bold;">CHECKER</span>
        </div>
        <div style="padding:28px; border:1px solid #eee; border-top:none; border-radius:0 0 12px 12px; text-align:center;">
          <p>Hallo ${anrede},</p>
          <p>bitte bestätigen Sie Ihre E-Mail-Adresse mit diesem Code:</p>
          <div style="font-size:32px; font-weight:bold; letter-spacing:0.2em; color:#0097B2; background:#F0F9FB; border-radius:10px; padding:16px; margin:20px 0;">${code}</div>
          <p style="font-size:13px; color:#6B7A8D;">Der Code ist 10 Minuten gültig.</p>
        </div>
      </div>`
  };

  await sgMail.send(mail);
  console.log(`[Elena] Bestätigungscode an ${email} verschickt.`);
}

module.exports = { versende, sendeCode };
