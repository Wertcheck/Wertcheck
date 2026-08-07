#!/usr/bin/env bash
# render-build.sh
# ────────────────
# WICHTIG: PUPPETEER_CACHE_DIR muss VOR "npm install" gesetzt sein.
# Puppeteer lädt Chrome bereits automatisch als Teil von "npm install"
# herunter (Postinstall-Hook) — wenn die Variable erst danach gesetzt
# wird, landet Chrome am Standard-Ort statt am gewünschten Pfad, und
# ein nachträgliches "npx puppeteer browsers install chrome" denkt
# fälschlich "ist schon da" und tut nichts (daher keine Ausgabe im Log).

set -o errexit

export PUPPETEER_CACHE_DIR="$(pwd)/.cache/puppeteer"
rm -rf "$PUPPETEER_CACHE_DIR"

npm install
