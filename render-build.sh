#!/usr/bin/env bash
# render-build.sh
# ────────────────
# Render trennt beim Node-Build den Cache-Ordner, in den Puppeteer Chrome
# herunterlädt, vom Pfad, den Puppeteer zur Laufzeit erwartet. Ohne dieses
# Skript meldet der Server "Could not find Chrome", obwohl der Build
# erfolgreich war — Chrome liegt dann einfach am falschen Ort.
#
# Muss unter Render → Settings → Build Command eingetragen werden
# (ersetzt den Standard-Build-Befehl "npm install").

set -o errexit

# 1) Normale Abhängigkeiten installieren (inkl. Puppeteer selbst)
npm install

# 2) Chrome für Puppeteer explizit installieren
PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR
npx puppeteer browsers install chrome

# 3) Cache zwischen Build-Cache-Pfad und Laufzeit-Pfad synchronisieren,
#    damit Chrome nach einem Redeploy zuverlässig wiedergefunden wird,
#    auch wenn Render den Build-Cache mal nicht wiederverwendet.
if [[ ! -d $PUPPETEER_CACHE_DIR/chrome ]]; then
  echo "...Kopiere Puppeteer-Cache aus dem Projektverzeichnis"
  cp -R /opt/render/project/src/.cache/puppeteer/chrome/ $PUPPETEER_CACHE_DIR/ 2>/dev/null || true
else
  echo "...Sichere Puppeteer-Cache für künftige Builds"
  mkdir -p /opt/render/project/src/.cache/puppeteer
  cp -R $PUPPETEER_CACHE_DIR/chrome/ /opt/render/project/src/.cache/puppeteer/ 2>/dev/null || true
fi
