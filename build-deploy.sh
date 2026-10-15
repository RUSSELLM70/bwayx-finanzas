#!/bin/sh
# Genera deploy/ con solo lo necesario para publicar (sin pruebas, README ni archivos internos).
#   sh build-deploy.sh               pruebas + deploy/ + BWAY-X-Finanzas.zip
#   sh build-deploy.sh --no-zip      sin zip (para Netlify/Cloudflare)
#   sh build-deploy.sh --skip-tests  sin pruebas
# Cada ejecución marca el service worker con un identificador único: el navegador de los usuarios detecta la versión nueva y se actualiza.
set -e
cd "$(dirname "$0")"
ZIP=1; TESTS=1
for a in "$@"; do case "$a" in --no-zip) ZIP=0;; --skip-tests) TESTS=0;; esac; done
[ "$TESTS" = 1 ] && npm test >/dev/null && echo "Pruebas: OK"
BUILD="${COMMIT_REF:-${CF_PAGES_COMMIT_SHA:-$(date +%Y%m%d%H%M%S)}}"; BUILD=$(printf %s "$BUILD" | cut -c1-12)
rm -rf deploy BWAY-X-Finanzas.zip
mkdir deploy
cp -R index.html manifest.webmanifest _headers css js icons deploy/
sed "s/finanzasos-v[0-9A-Za-z]*/finanzasos-$BUILD/" sw.js > deploy/sw.js
grep -q "finanzasos-$BUILD" deploy/sw.js || { echo "No se pudo marcar la versión del service worker"; exit 1; }
echo "Versión publicada: $BUILD"
if [ "$ZIP" = 1 ]; then (cd deploy && zip -qr ../BWAY-X-Finanzas.zip .); echo "Listo: deploy/ y BWAY-X-Finanzas.zip ($(du -sh BWAY-X-Finanzas.zip | cut -f1))"; else echo "Listo: deploy/"; fi
