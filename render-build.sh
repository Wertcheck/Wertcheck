#!/usr/bin/env bash
# render-build.sh
# ────────────────
# WICHTIG: Der Cache-Ordner muss INNERHALB des Projektordners liegen
# (nicht z.B. unter /opt/render/.cache) — Render überträgt nach dem
# Build nur den Inhalt des Projektordners an die Laufzeitumgebung.
# Alles außerhalb davon geht beim Übergang von "Build" zu "Deploy"
# verloren, auch wenn der Build selbst fehlerfrei durchläuft.

set -o errexit

npm install

export PUPPETEER_CACHE_DIR="$(pwd)/.cache/puppeteer"
rm -rf "$PUPPETEER_CACHE_DIR"
mkdir -p "$PUPPETEER_CACHE_DIR"

npx puppeteer browsers install chrome
