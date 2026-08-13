# @efa-one/sdk

Offizielles SDK zum Bauen von **efa-one-Apps**. Es ist die verbindliche
Integrationsschicht, die jede App einbettet, um ein First-Class-Bürger der
Plattform zu sein: Auth gegen den Kernel, Clients zu den Plattform-Services und
das Frontend-IPC-/i18n-Toolkit für die iframe-Einbettung.

## Zwei Entry-Points

Das SDK ist gemischt server-/browserseitig und daher in zwei Sub-Pfade getrennt,
damit `express` nicht ins Frontend und `react` nicht ins Backend leakt:

| Import | Läuft in | Enthält |
|---|---|---|
| `@efa-one/sdk/backend` | Node/Express | Auth + Token-Exchange (`requireAuth`, `createExchangeRouter`, `requireInternalOrAuth` …), Health-Router, Service-Discovery + Gateway-Client (`serviceClient`, `resolveService`), Clients für Audit/Reporting/Mail/Notifications, Permission-Auflösung/-Registrierung (`getUserPermissions`, `registerPermissions`, `checkPermission`), Capability-Registry (`registerApiMetadata`), Backend-i18n |
| `@efa-one/sdk/frontend` | Browser/React | postMessage-IPC (`sendDeclareAppInfo`, `sendAtStart`, `navigateToApp`, `notifyRouteChange` …), react-i18next-Factory (`initI18n`), `DevHeader` |

Jedes Einzelmodul ist zusätzlich direkt erreichbar, z. B.
`@efa-one/sdk/backend/auth` oder `@efa-one/sdk/frontend/ipc`.

> **Hinweis zu Legacy-Präfixen:** Einige plattform-interne Identifier (postMessage-
> Nachrichtentypen, Env-Variablen-Namen, JWT-`iss`) tragen noch technische
> Legacy-Präfixe aus einer früheren Namensgebung. Diese sind Teil des Draht-
> Protokolls zwischen App und Kernel und werden gemeinsam mit dem Kernel in einem
> koordinierten Schritt migriert — nicht einseitig im SDK.

## Installation

```bash
# im Backend-Projekt der App
npm install @efa-one/sdk express pg jsonwebtoken

# im Frontend-Projekt der App
npm install @efa-one/sdk react i18next i18next-http-backend react-i18next
```

Die Runtime-Bibliotheken sind **optionale Peer-Dependencies** — installiere nur die
zum genutzten Entry-Point passenden. Das SDK selbst bündelt sie nicht.

## Verwendung

```ts
// Backend
import { createExchangeRouter, requireAuth, serviceClient } from '@efa-one/sdk/backend';

app.use('/api/auth', createExchangeRouter());
app.get('/api/items', requireAuth, handler);
```

```tsx
// Frontend
import { initI18n, sendDeclareAppInfo, DevHeader } from '@efa-one/sdk/frontend';

sendDeclareAppInfo({ appName: 'efa-chat', version: __APP_VERSION__ });
```

## Build

Reines `tsc`, kein Bundler. Zwei Targets:

```bash
npm install          # devDeps + Peer-Libs zum Typecheck
npm run build        # backend/ (CJS) + frontend/ (ESM), je mit .d.ts
npm run typecheck    # nur Typprüfung, kein Emit
```

- `backend/` — CommonJS (`module: commonjs`)
- `frontend/` — ESM (`module: esnext`, `moduleResolution: bundler`), via
  `frontend/package.json` als `{"type":"module"}` markiert; App-Bundler (Vite)
  konsumieren es direkt.

Das flache Output-Layout (`backend/` + `frontend/` im Paket-Root) ist bewusst so
gewählt, damit Consumer mit `moduleResolution: node` (node10) die Subpath-Importe
physisch auflösen — ohne dass sie ihre tsconfig anpassen müssen.

## Publish

Public auf npmjs unter dem Scope `@efa-one` (`publishConfig.access = "public"` ist
gesetzt).

**Automatisiert (Standardweg):** ein `v*`-Tag löst den Publish via GitHub Actions
aus (`.github/workflows/publish.yml`) — analog zum GHCR-Flow der Apps. Der Workflow
gleicht Tag ↔ `package.json`-Version ab, läuft Tests + Typecheck als Gate und
publiziert dann.

```bash
npm version patch          # bumpt package.json + legt Commit + Tag an
git push --follow-tags     # Tag-Push triggert den Publish-Job
```

Einmalige Voraussetzung: Repo-Secret **`NPM_TOKEN`** (Automation-Token eines
Accounts mit Publish-Recht auf `@efa-one`) unter *Settings → Secrets and variables →
Actions*.

**Manuell (Fallback):**

```bash
npm login          # Account muss Publish-Recht auf @efa-one haben
npm publish        # baut via prepublishOnly automatisch neu
```

`npm install` durch Apps/CI/Docker braucht **keine** Credentials — nur der
Publish-Schritt.

## Migration einer bestehenden App

Von kopiertem `template-core/` auf das Paket umstellen: siehe
[MIGRATION.md](./MIGRATION.md) (Import-Mapping, tsconfig/vite-Entkopplung,
Dockerfile-Bereinigung, Lockfile-Regen).

## Versionierung

SemVer. Template-Migration = `npm version` + publish; App-Update =
`npm update @efa-one/sdk`.

## Lizenz

[Apache-2.0](./LICENSE) — permissiv mit Patent-Grant, damit Kunden und Partner ohne
Reibung efa-one-Apps bauen können.
