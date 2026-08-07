#!/usr/bin/env bash
# render-build.sh
# ────────────────
# Installiert die Abhängigkeiten und lädt danach explizit einen
# Chrome-Browser für Puppeteer herunter, in einen festen Cache-Pfad,
# damit tim.js ihn zur Laufzeit zuverlässig findet.
#
# WICHTIG: Der Cache-Ordner wird vor jedem Install-Versuch komplett
# geleert. Ohne das kann ein unvollständiger Rest von einem
# vorherigen, abgebrochenen Build dazu führen, dass Puppeteer denkt
# "ist schon da" und den Download überspringt, obwohl die eigentliche
# Programmdatei fehlt ("Error: ... executable is missing").

set -o errexit

npm install

export PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
rm -rf "$PUPPETEER_CACHE_DIR"
mkdir -p "$PUPPETEER_CACHE_DIR"

npx puppeteer browsers install chrome
