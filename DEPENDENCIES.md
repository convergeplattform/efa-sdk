# DEPENDENCIES – @efa-one/sdk

Externe Bausteine dieses Repos auf einen Blick. Transitive npm-Deps werden **nicht**
von Hand gepflegt → siehe `package-lock.json` + `npm audit`.

## Runtime-Dependencies (gebündelt)

**Keine.** Das SDK bündelt keine Runtime-Bibliotheken. Alle externen Laufzeit-Libs
sind Peer-Dependencies (siehe unten) und werden von der konsumierenden App gestellt.

## Peer-Dependencies (optional, von der App bereitzustellen)

| Paket | Version | Lizenz | Zweck | Entry-Point |
|---|---|---|---|---|
| `express` | `>=4` | MIT | HTTP-Framework — Middleware-Typen (`Request`/`Response`), Router | backend |
| `pg` | `>=8` | MIT | PostgreSQL-Client — Typen für DB-gestützte Auth/Provisioning | backend |
| `jsonwebtoken` | `>=9` | MIT | JWT-Signatur/-Verifikation (RS256 Plattform-Token, HS256 App-Session) | backend |
| `react` | `>=18` | MIT | UI-Runtime für `DevHeader` und die i18n-Factory | frontend |
| `i18next` | `>=23` | MIT | i18n-Kern | frontend |
| `i18next-http-backend` | `>=2` | MIT | Lädt Übersetzungs-Ressourcen per HTTP (Backend-Plugin für i18next in `initI18n`) | frontend |
| `react-i18next` | `>=13` | MIT | React-Bindings für i18next (`initI18n`) | frontend |

Alle als `optional` markiert (`peerDependenciesMeta`), da App-Backend und
App-Frontend getrennte npm-Projekte sind und je nur einen Entry-Point nutzen.

## Dev-Dependencies (nur Build/Typecheck, nicht publiziert)

| Paket | Version | Lizenz | Zweck |
|---|---|---|---|
| `typescript` | `7.0.2` (exakt) | Apache-2.0 | Compiler — zwei Build-Targets (CJS/ESM) + `.d.ts`. Exakt gepinnt wie plattformweit. |
| `@types/node` | `^20` | MIT | Node-Typen (process, Buffer …) fürs Backend |
| `@types/express` | `^4.17` | MIT | Typen zu `express` |
| `@types/pg` | `^8.11` | MIT | Typen zu `pg` |
| `@types/jsonwebtoken` | `^9.0` | MIT | Typen zu `jsonwebtoken` |
| `@types/react` | `^18.2` | MIT | Typen zu `react` |
| `@types/supertest` | `^7.2` | MIT | Typen zu `supertest` |
| `vitest` | `^4.1` | MIT | Test-Runner (`npm test`, `test/**`) |
| `supertest` | `^7.2` | MIT | HTTP-Integrationstests der Auth-/Exchange-Router |
| `cookie-parser` | `^1.4` | MIT | nur Test-Harness (Exchange-Router-Cookie-Tests) |
| `express`, `pg`, `jsonwebtoken`, `react`, `i18next`, `i18next-http-backend`, `react-i18next` | s. o. | MIT | Zum Typecheck der Peer-Nutzung installiert |

## Container-/OS-Schicht

**Keine.** Reines TypeScript-Library-Paket — kein Dockerfile, kein Base-Image, keine
`apk`/`apt`-Pakete. Wird von den App-Repos konsumiert, nicht selbst deployt.
