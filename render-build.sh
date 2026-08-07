#!/usr/bin/env bash
# render-build.sh
# ────────────────
# Zwei Chrome-Installationsversuche liefen sich zuvor gegenseitig in
# die Quere: npm install stößt automatisch (im Hintergrund) einen
# Chrome-Download an, der unvollständig abbricht — der nachfolgende
# explizite "npx puppeteer browsers install chrome" fand dann einen
# kaputten Rest davon vor und scheiterte ebenfalls.
#
# Deshalb: automatischen Download während npm install per
# PUPPETEER_SKIP_DOWNLOAD unterdrücken, danach den Download EINMAL
# kontrolliert selbst auslösen.

set -o errexit

export PUPPETEER_CACHE_DIR="$(pwd)/.cache/puppeteer"
rm -rf "$PUPPETEER_CACHE_DIR"
rm -rf node_modules

export PUPPETEER_SKIP_DOWNLOAD=true
npm install
unset PUPPETEER_SKIP_DOWNLOAD

# Sicherheitshalber nochmal leeren, falls trotz PUPPETEER_SKIP_DOWNLOAD
# doch ein Rest entstanden ist.
rm -rf "$PUPPETEER_CACHE_DIR"

echo "── Installiere Chrome für Puppeteer explizit ──"
npx puppeteer browsers install chrome
echo "── Chrome-Installation abgeschlossen ──"
ls -la "$PUPPETEER_CACHE_DIR"
