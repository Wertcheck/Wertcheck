#!/usr/bin/env bash
# render-build.sh
# ────────────────
# Löscht node_modules VOR der Installation, damit npm den
# Puppeteer-Postinstall-Hook (Chrome-Download) garantiert neu
# ausführt, statt einen möglicherweise kaputten Cache-Zustand aus
# einem früheren Build wiederzuverwenden.

set -o errexit

export PUPPETEER_CACHE_DIR="$(pwd)/.cache/puppeteer"
rm -rf "$PUPPETEER_CACHE_DIR"
rm -rf node_modules

npm install
