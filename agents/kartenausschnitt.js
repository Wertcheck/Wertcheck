/**
 * KARTENAUSSCHNITT — Google Static Maps Anbindung
 * ─────────────────────────────────────────────────
 * Holt für eine Adresse einen fertigen Kartenausschnitt (PNG) von der
 * Google Static Maps API. Läuft serverseitig, damit der API-Key nicht
 * im Frontend-Code sichtbar ist.
 *
 * WICHTIG: Dafür muss in der Google Cloud Console zusätzlich die
 * "Maps Static API" aktiviert sein (eigene API, nicht automatisch mit
 * der Maps JavaScript API aktiv) — und der Key als Umgebungsvariable
 * GOOGLE_MAPS_API_KEY bei Render hinterlegt werden.
 */

const https = require('https');

function holeKartenausschnitt(adresse, breite = 420, hoehe = 300) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('GOOGLE_MAPS_API_KEY ist nicht gesetzt'));
      return;
    }
    if (!adresse || !adresse.trim()) {
      reject(new Error('Keine Adresse übergeben'));
      return;
    }

    const params = new URLSearchParams({
      center: adresse,
      zoom: '16',
      size: `${breite}x${hoehe}`,
      scale: '2', // schärfer für Druck/PDF
      maptype: 'roadmap',
      markers: `color:0x0097B2|${adresse}`,
      key: apiKey
    });

    const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Static Maps API antwortete mit Status ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = { holeKartenausschnitt };
