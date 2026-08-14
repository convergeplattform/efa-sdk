#!/usr/bin/env bash
# Lokaler Spiegel von .github/workflows/security.yml — VOR dem Push ausführen,
# damit man die "workflow failed"-Benachrichtigung nicht erst nach dem Push sieht.
#
# Prüft dieselben Gates wie die CI:
#   1. npm audit  (Hard-Fail nur bei CRITICAL)         — nutzt Lockfile, schnell
#   2. License-Gate (prod-Install + Copyleft-Verbot)   — Install nötig, langsamer
#   3. Trivy fs-Scan (CRITICAL, ignore-unfixed)        — nur wenn `trivy` installiert
#   4. Trivy config/secret (report-only, bricht nicht) — nur wenn `trivy` installiert
#
# Usage:  ci-local.sh [repo-verzeichnis]     (Default: aktuelles Verzeichnis)
# Exit 0 = alle blockierenden Gates grün, sonst 1.

set -uo pipefail
REPO="${1:-.}"
cd "$REPO" || { echo "Verzeichnis nicht gefunden: $REPO"; exit 2; }
echo "▶ CI-Local in: $(pwd)"

# Identisch zur Copyleft-Liste in security.yml.
COPYLEFT="GPL-1.0-only;GPL-1.0-or-later;GPL-2.0-only;GPL-2.0-or-later;GPL-3.0-only;GPL-3.0-or-later;AGPL-1.0-only;AGPL-1.0-or-later;AGPL-3.0-only;AGPL-3.0-or-later;LGPL-2.0-only;LGPL-2.1-only;LGPL-2.1-or-later;LGPL-3.0-only;LGPL-3.0-or-later"

FAIL=0

for dir in backend frontend; do
  [ -f "$dir/package.json" ] || continue
  echo ""
  echo "── $dir ───────────────────────────────────────────────"

  # 1) npm audit (kein Install nötig)
  if ( cd "$dir" && npm audit --audit-level=critical >/tmp/cil-audit.txt 2>&1 ); then
    echo "  ✓ npm audit: keine CRITICAL"
  else
    echo "  ✗ npm audit: CRITICAL gefunden"; sed 's/^/      /' /tmp/cil-audit.txt | tail -8; FAIL=1
  fi

  # 2) License-Gate. Schnellpfad: vorhandene node_modules direkt prüfen (kein Install
  # → Hook bleibt schnell). Nur wenn keine da sind, ephemerer prod-Install.
  if [ -d "$dir/node_modules" ]; then
    if ( cd "$dir" && npx --yes license-checker --production --failOn "$COPYLEFT" >/dev/null 2>&1 ); then
      echo "  ✓ License-Gate: keine Copyleft-Lizenz (vorhandene node_modules)"
    else
      echo "  ✗ License-Gate: Copyleft (GPL/AGPL/LGPL) gefunden — Details:"
      ( cd "$dir" && npx --yes license-checker --production --failOn "$COPYLEFT" 2>&1 | grep -iE "GPL|error" | head -5 | sed 's/^/      /' )
      FAIL=1
    fi
  else
    TMP="$(mktemp -d)"; cp "$dir"/package*.json "$TMP"/ 2>/dev/null
    if ( cd "$TMP" && npm install --omit=dev --ignore-scripts --no-audit --no-fund --legacy-peer-deps >/dev/null 2>&1 ); then
      if ( cd "$TMP" && npx --yes license-checker --production --failOn "$COPYLEFT" >/dev/null 2>&1 ); then
        echo "  ✓ License-Gate: keine Copyleft-Lizenz (frischer prod-Install)"
      else
        echo "  ✗ License-Gate: Copyleft (GPL/AGPL/LGPL) gefunden"; FAIL=1
      fi
    else
      echo "  ✗ prod-Install fehlgeschlagen (ERESOLVE?) — CI würde hier rot"; FAIL=1
    fi
    rm -rf "$TMP"
  fi
done

# 3+4) Trivy (optional — nur wenn installiert; sonst überspringen)
echo ""
if command -v trivy >/dev/null 2>&1; then
  echo "── trivy fs (CRITICAL, ignore-unfixed) ────────────────"
  if trivy fs --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 --quiet . ; then
    echo "  ✓ trivy fs: keine CRITICAL"
  else
    echo "  ✗ trivy fs: CRITICAL gefunden"; FAIL=1
  fi
  echo "── trivy config/secret (report-only) ──────────────────"
  trivy fs --scanners misconfig,secret --severity HIGH,CRITICAL --exit-code 0 --quiet . || true
else
  echo "(trivy nicht installiert → fs-/config-Scan übersprungen. Install: brew install trivy)"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "✅ Alle blockierenden CI-Gates lokal GRÜN — Push sollte durchlaufen."
else
  echo "❌ Mindestens ein Gate ROT — vor dem Push fixen (sonst kommt die failed-Benachrichtigung)."
fi
exit "$FAIL"
