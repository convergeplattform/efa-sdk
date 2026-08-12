# @efa-one/sdk

Offizielles SDK zum Bauen von **efa-one-Apps** (vormals „Converge"). Es ist die
verbindliche Integrationsschicht, die jede App einbettet, um ein First-Class-Bürger
der Plattform zu sein: Auth gegen den Kernel, Clients zu den Plattform-Services und
das Frontend-IPC-/i18n-Toolkit für die iframe-Einbettung.

> **Hinweis zur Herkunft:** Dieses Paket ist die Auslagerung des vormaligen
> `template-core/`-Verzeichnisses, das bisher in jede App kopiert wurde. Der
> Paket-*Name* trägt bereits die neue Marke (efa-one); die *Protokoll-Interna*
> (postMessage-Konstanten `CONVERGE_*`, Env-Namen `CONVERGE_*`, JWT-`iss`) bleiben
> vorerst unverändert und werden erst mit dem vollständigen Plattform-Rebrand
> migriert.

## Zwei Entry-Points

Das SDK ist gemischt server-/browserseitig und daher in zwei Sub-Pfade getrennt,
damit `express` nicht ins Frontend und `react` nicht ins Backend leakt:

| Import | Läuft in | Enthält |
|---|---|---|
| `@efa-one/sdk/backend` | Node/Express | Auth + Token-Exchange (`requireAuth`, `createExchangeRouter`, `requireInternalOrAuth` …), Health-Router, Service-Discovery + Gateway-Client (`serviceClient`, `resolveService`), Clients für Audit/Reporting/Mail/Notifications, Permission-Auflösung/-Registrierung (`getUserPermissions`, `registerPermissions`, `checkPermission`), Capability-Registry (`registerApiMetadata`), Backend-i18n |
| `@efa-one/sdk/frontend` | Browser/React | postMessage-IPC (`sendDeclareAppInfo`, `navigateToApp`, `notifyRouteChange`, `isFromConvergeParent` …), react-i18next-Factory (`initI18n`), `DevHeader` |

Jedes Einzelmodul ist zusätzlich direkt erreichbar, z. B.
`@efa-one/sdk/backend/auth` oder `@efa-one/sdk/frontend/ipc`.

## Installation

```bash
# im Backend-Projekt der App
npm install @efa-one/sdk express pg jsonwebtoken

# im Frontend-Projekt der App
npm install @efa-one/sdk react i18next react-i18next
```

Die Runtime-Bibliotheken (`express`/`pg`/`jsonwebtoken` bzw. `react`/`i18next`/
`react-i18next`) sind **optionale Peer-Dependencies** — installiere nur die zum
genutzten Entry-Point passenden. Das SDK selbst bündelt sie nicht.

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
npm run build        # dist/backend (CJS) + dist/frontend (ESM), je mit .d.ts
npm run typecheck    # nur Typprüfung, kein Emit
```

- `dist/backend/` — CommonJS (`module: commonjs`)
- `dist/frontend/` — ESM (`module: esnext`, `moduleResolution: bundler`), via
  `dist/frontend/package.json` als `{"type":"module"}` markiert; App-Bundler (Vite)
  konsumieren es direkt.

## Publish

Public auf npmjs unter dem Scope `@efa-one` (`publishConfig.access = "public"` ist
gesetzt, kein `--access`-Flag nötig):

```bash
npm login                 # einmalig; Account muss Mitglied der @efa-one-Org sein
npm publish               # baut via prepublishOnly automatisch neu
```

`npm install` durch Apps/CI/Docker braucht **keine** Credentials — nur der
Publish-Schritt.

## Versionierung

SemVer, gestartet bei `1.10.0` (Fortführung des vormaligen
`converge-template-version`-Headers). Template-Migration = `npm version` + publish;
App-Update = `npm update @efa-one/sdk`. Ersetzt das bisherige Patch-Tag-Kopieren
von `template-core/`.

## Lizenz

[Apache-2.0](./LICENSE) — permissiv mit Patent-Grant, damit Kunden und Partner ohne
Reibung efa-one-Apps bauen können. Die Marke „efa-one"/„Converge" ist davon nicht
erfasst (siehe Abschnitt 6 der Lizenz).
