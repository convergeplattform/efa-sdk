#!/usr/bin/env bash
# Lokaler Spiegel von .github/workflows/{build-check,security}.yml — VOR dem Push
# ausführen, damit man die „workflow failed"-Mail nicht erst nach dem Push sieht.
#
# Prüft dieselben blockierenden Gates wie die CI:
#   1. typecheck + Tests inkl. Coverage-Gate + ESLint + Build   (build-check.yml, Job `sdk`)
#   2. npm ci im Scaffold                                       (build-check.yml, Job `template`)
#   3. npm audit --audit-level=high in allen 3 npm-Verzeichnissen (security.yml)
#   4. License-Gate (prod-Install + Copyleft-Verbot)              (security.yml)
#   5. Trivy fs-Scan (HIGH/CRITICAL, ignore-unfixed)              (security.yml)
#      — nutzt `trivy`, falls installiert, sonst Docker; ohne beides wird übersprungen.
#
# Usage:  ./scripts/ci-local.sh
# Exit 0 = alle blockierenden Gates grün, sonst 1.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"
echo "▶ CI-Local in: $ROOT"

# Identisch zur Copyleft-Liste in security.yml.
COPYLEFT="GPL-1.0-only;GPL-1.0-or-later;GPL-2.0-only;GPL-2.0-or-later;GPL-3.0-only;GPL-3.0-or-later;AGPL-1.0-only;AGPL-1.0-or-later;AGPL-3.0-only;AGPL-3.0-or-later;LGPL-2.0-only;LGPL-2.1-only;LGPL-2.1-or-later;LGPL-3.0-only;LGPL-3.0-or-later"

FAIL=0
step() { printf '\n── %s ───────────────────────────────\n' "$1"; }
ok()   { echo "  ✓ $1"; }
bad()  { echo "  ✗ $1"; FAIL=1; }

# ── 1) SDK: typecheck + Coverage-Gate + Lint + Build ────────────────────────────
step "SDK (build-check.yml → sdk)"
[ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null 2>&1
for pair in "typecheck:npm run typecheck" "test:coverage:npm run test:coverage" "lint:npm run lint" "build:npm run build"; do
  name="${pair%%:npm*}"; cmd="npm${pair#*:npm}"
  if $cmd >/tmp/cil-$$.log 2>&1; then ok "$name"; else bad "$name"; tail -20 /tmp/cil-$$.log | sed 's/^/      /'; fi
done

# ── 2) Scaffold: npm ci (Lockfile ↔ Manifest) ───────────────────────────────────
step "Scaffold (build-check.yml → template)"
for dir in template/backend template/frontend; do
  if ( cd "$dir" && npm ci --no-audit --no-fund ) >/tmp/cil-$$.log 2>&1; then
    ok "npm ci $dir"
    if ( cd "$dir" && npm run test:coverage ) >/tmp/cil-$$.log 2>&1; then
      ok "npm run test:coverage $dir"
    else
      bad "npm run test:coverage $dir"; tail -20 /tmp/cil-$$.log | sed 's/^/      /'
    fi
    if ( cd "$dir" && npm run typecheck:test --if-present ) >/tmp/cil-$$.log 2>&1; then
      ok "typecheck:test $dir"
    else
      bad "typecheck:test $dir"; tail -15 /tmp/cil-$$.log | sed 's/^/      /'
    fi
    if ( cd "$dir" && npm run build ) >/tmp/cil-$$.log 2>&1; then
      ok "npm run build $dir"
    else
      bad "npm run build $dir"; tail -15 /tmp/cil-$$.log | sed 's/^/      /'
    fi
  else
    bad "npm ci $dir"; tail -12 /tmp/cil-$$.log | sed 's/^/      /'
  fi
done

# ── 3+4) npm audit + License-Gate je Verzeichnis ────────────────────────────────
for dir in . template/backend template/frontend; do
  step "security.yml → $dir"
  if ( cd "$dir" && npm audit --audit-level=high ) >/tmp/cil-$$.log 2>&1; then
    ok "npm audit (keine HIGH/CRITICAL)"
  else
    bad "npm audit: HIGH/CRITICAL gefunden"
    ( cd "$dir" && npm audit --audit-level=high 2>&1 | tail -12 | sed 's/^/      /' )
  fi

  # License-Gate gegen einen ephemeren prod-Install (wie in der CI), damit devDeps
  # das Ergebnis nicht verfälschen.
  TMP="$(mktemp -d)"
  # Ohne diese Prüfung besteht das Gate still, wenn die Kopie fehlschlägt:
  # license-checker meldet in einem leeren Verzeichnis "No packages found" mit Exit 0.
  if ! cp "$dir"/package.json "$TMP"/ 2>/dev/null; then
    bad "License-Gate: package.json in $dir nicht gefunden"; rm -rf "$TMP"; continue
  fi
  cp "$dir"/package-lock.json "$TMP"/ 2>/dev/null || true
  if ( cd "$TMP" && npm install --omit=dev --ignore-scripts --no-audit --no-fund ) >/dev/null 2>&1; then
    if ( cd "$TMP" && npx --yes license-checker --production --failOn "$COPYLEFT" ) >/dev/null 2>&1; then
      ok "License-Gate (kein GPL/AGPL/LGPL)"
    else
      bad "License-Gate: Copyleft gefunden"
      ( cd "$TMP" && npx --yes license-checker --production --failOn "$COPYLEFT" 2>&1 | grep -iE "GPL|error" | head -5 | sed 's/^/      /' )
    fi
  else
    bad "License-Gate: prod-Install fehlgeschlagen"
  fi
  rm -rf "$TMP"
done

# ── 5) Trivy fs-Scan (blockierender Lauf aus security.yml) ──────────────────────
step "Trivy fs (security.yml → trivy)"
# --include-dev-deps: ohne den Schalter überspringt Trivy die devDependencies in
# npm-Lockfiles — für dieses Repo wäre der Scan sonst strukturell wirkungslos
# (identisch zu TRIVY_INCLUDE_DEV_DEPS in security.yml).
TRIVY_ARGS="fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --include-dev-deps --exit-code 1"
if command -v trivy >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  if TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 trivy $TRIVY_ARGS "$ROOT" >/tmp/cil-$$.log 2>&1; then
    ok "trivy (lokal): keine HIGH/CRITICAL mit Fix"
  else
    bad "trivy (lokal): Findings"; tail -25 /tmp/cil-$$.log | sed 's/^/      /'
  fi
elif command -v docker >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  if docker run --rm -e TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db:2 \
       -v "$ROOT":/repo:ro -v "$HOME/.cache/trivy":/root/.cache/trivy \
       aquasec/trivy:latest $TRIVY_ARGS /repo >/tmp/cil-$$.log 2>&1; then
    ok "trivy (docker): keine HIGH/CRITICAL mit Fix"
  else
    bad "trivy (docker): Findings"; tail -25 /tmp/cil-$$.log | sed 's/^/      /'
  fi
else
  echo "  ⚠ trivy übersprungen (weder trivy noch docker vorhanden)"
fi

rm -f /tmp/cil-$$.log
echo ""
[ "$FAIL" -eq 0 ] && echo "✅ Alle blockierenden Gates grün." || echo "❌ Mindestens ein Gate rot — siehe oben."
exit "$FAIL"
