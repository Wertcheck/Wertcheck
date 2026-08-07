#!/usr/bin/env bash
# render-build.sh
# ────────────────
# 1) Cache-Ordner + node_modules sauber leeren (kein Rest von
#    früheren, fehlgeschlagenen Versuchen).
# 2) PUPPETEER_CACHE_DIR ist schon gesetzt, BEVOR npm install läuft.
# 3) Zusätzlich Chrome explizit installieren — der automatische
#    Download während npm install allein reicht bei dieser
#    Puppeteer-Version offenbar nicht aus (kein Download-Log sichtbar).

set -o errexit

export PUPPETEER_CACHE_DIR="$(pwd)/.cache/puppeteer"
rm -rf "$PUPPETEER_CACHE_DIR"
rm -rf node_modules

npm install

echo "── Installiere Chrome für Puppeteer explizit ──"
npx puppeteer browsers install chrome
echo "── Chrome-Installation abgeschlossen ──"
ls -la "$PUPPETEER_CACHE_DIR"
