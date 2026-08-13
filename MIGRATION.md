# Migration: kopiertes `template-core/` → `@efa-one/sdk`

Rezept, um eine bestehende App vom eingebetteten `template-core/`-Verzeichnis auf
das npm-Paket `@efa-one/sdk` umzustellen. Erprobt an `rw5` (Standard-Stack, 3
Container). Für Single-Container-Apps gilt dasselbe, nur ohne getrennten
Frontend-Schritt.

Kernidee: das früher pro App **kopierte** `template-core/` wird durch **eine
versionierte Dependency** ersetzt. Kein Drift mehr, ein Update pro `npm update`.

---

## 1. Dependency eintragen

In **beiden** Teilprojekten `@efa-one/sdk` als Dependency ergänzen (aktuelle
Version aus `npm view @efa-one/sdk version`):

```jsonc
// backend/package.json  UND  frontend/package.json
"dependencies": {
  "@efa-one/sdk": "^1.10.1",
  …
}
```

Die Runtime-Libs des SDK sind **optionale** Peer-Deps — die App hat `express`/`pg`/
`jsonwebtoken` (Backend) bzw. `react`/`i18next…` (Frontend) ohnehin schon in ihren
`package.json`. Nichts zusätzlich nötig.

## 2. Imports umschreiben

Relative `template-core/`-Pfade → SDK-Subpath. Jedes Einzelmodul ist direkt
erreichbar:

| Vorher (kopiert) | Nachher (SDK) |
|---|---|
| `../../template-core/auth` | `@efa-one/sdk/backend/auth` |
| `../../template-core/health` | `@efa-one/sdk/backend/health` |
| `../../template-core/audit` | `@efa-one/sdk/backend/audit` |
| `../../template-core/reporting` | `@efa-one/sdk/backend/reporting` |
| `../../template-core/permissions` | `@efa-one/sdk/backend/permissions` |
| `../../template-core/apiRegistry` | `@efa-one/sdk/backend/apiRegistry` |
| `../../template-core/serviceClient` | `@efa-one/sdk/backend/serviceClient` |
| `../../template-core/serviceDiscovery` | `@efa-one/sdk/backend/serviceDiscovery` |
| `../../template-core/ipc` | `@efa-one/sdk/frontend/ipc` |
| `../../template-core/i18n` | `@efa-one/sdk/frontend/i18n` |
| `../../template-core/DevHeader` | `@efa-one/sdk/frontend/DevHeader` |

Alternativ das gebündelte Barrel: `@efa-one/sdk/backend` bzw. `@efa-one/sdk/frontend`.

Sweep (aus dem App-Root, prüfen bevor `sed`):

```bash
grep -rn "template-core" backend/src frontend/src
# Backend:
grep -rl "template-core" backend/src | xargs sed -i '' -E "s#(\.\./)+template-core/#@efa-one/sdk/backend/#g"
# Frontend:
grep -rl "template-core" frontend/src | xargs sed -i '' -E "s#(\.\./)+template-core/#@efa-one/sdk/frontend/#g"
```

## 3. tsconfig + vite entkoppeln

Alles, was auf das kopierte `template-core/` zeigte, raus — das SDK löst sich über
`node_modules` auf.

**`backend/tsconfig.json`**: `rootDir: "src"`, `include: ["src/**/*"]`,
`exclude: ["node_modules","dist"]`. Die früheren `"../template-core/**/*"`-Includes
**entfernen**.

> ⚠️ `rootDir: "src"` ändert die Emit-Struktur: Output ist jetzt `dist/index.js`
> (vorher konnte durch `template-core`-Includes ein `dist/backend/…`-Prefix
> entstehen). Dockerfile-`CMD` und Asset-Copies entsprechend anpassen (Schritt 4).

**`frontend/tsconfig.json`**: `@template-core`-`paths`, -`include`, -`exclude`
löschen → schlank `include: ["src"]`.

**`frontend/vite.config.ts`**: den `@template-core`-`resolve.alias` und den
zugehörigen `path`-Import entfernen. Vite löst das SDK aus `node_modules`.

## 4. Dockerfiles bereinigen

Der Build-Kontext war früher das Repo-Root, um `template-core/` mit
hineinzukopieren. Das entfällt — das SDK kommt via `npm ci` aus der Registry.

- **Keine** `COPY template-core/ …`-Zeilen mehr.
- `CMD ["node", "dist/index.js"]` (an die Emit-Struktur aus Schritt 3 anpassen).
- Non-TS-Assets an den neuen Emit-Ort kopieren, z. B.
  `RUN cp backend/src/db/schema.sql backend/dist/db/schema.sql`.

`npm ci` in beiden Stages braucht **keine** Registry-Credentials — `@efa-one/sdk`
ist public.

## 5. Verzeichnis löschen + Lockfiles regenerieren

```bash
rm -rf template-core
```

Lockfiles **immer unter `--platform linux/amd64`** neu erzeugen (CI/Prod bauen
amd64 — sonst driften plattform-spezifische Optional-Deps):

```bash
for d in backend frontend; do
  docker run --rm --platform linux/amd64 -v "$PWD/$d":/w -w /w \
    node:24-alpine sh -c "npm install --ignore-scripts --package-lock-only"
done
```

Verifizieren, dass die Auflösung aus der Registry kommt (nicht `file:`):

```bash
grep -A2 '"node_modules/@efa-one/sdk"' backend/package-lock.json
# → "resolved": "https://registry.npmjs.org/@efa-one/sdk/-/sdk-1.10.1.tgz"
```

## 6. Bauen, deployen, verifizieren

```bash
docker build --platform linux/amd64 -f backend/Dockerfile  -t <app>-backend:dev  .
docker build --platform linux/amd64 -f frontend/Dockerfile -t <app>-frontend:dev .
```

Am laufenden lokalen Stack prüfen:

- Backend-Log: `Permissions registriert` + `API-Metadaten registriert` (200, kein 401)
- SDK-Auflösung im Container:
  `docker exec <app>-backend node -e "console.log(require('@efa-one/sdk/package.json').version)"`
- Gateway-Routing: `curl -s -o /dev/null -w '%{http_code}' http://localhost/apps/<service_key>/`
  → `302` (Redirect zum Login) = korrekt geroutet.
- Kachel öffnet sauber (Playwright-Console-Check aus dem Stop-Hook).

## 7. Docs synchron halten

`DEPENDENCIES.md` der App: `template-core (kopiert)` → `@efa-one/sdk` (Version,
Lizenz Apache-2.0, Zweck). README/CLAUDE-Verweise auf `template-core` auf das SDK
umstellen. Ohne aktualisierte `DEPENDENCIES.md`/README ist die Migration nicht
abgeschlossen.

---

### Häufige Stolpersteine

| Symptom | Ursache | Fix |
|---|---|---|
| Container startet nicht, `Cannot find module '/app/dist/index.js'` | `rootDir`-Wechsel hat Emit-Ort verschoben | `CMD` + Asset-Copies an neue `dist/`-Struktur anpassen (Schritt 4) |
| `npm ci` bricht mit `file:vendor/...` ab | Lockfile referenziert noch lokalen Tarball | Lockfiles neu erzeugen (Schritt 5), Registry-Auflösung prüfen |
| „lokal grün, CI rot" bei Optional-Deps | Lockfile auf arm64 erzeugt | Regen **immer** unter `--platform linux/amd64` |
| Frontend zeigt alten Stand | Frontend-Image nicht neu gebaut/recreated | Image bauen **und** Container force-recreaten |
