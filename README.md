# @efa-one/sdk

Official SDK for building **efa-one apps**. It is the integration layer every app
embeds to become a first-class citizen of the platform: authentication against the
kernel, clients for the platform services, and the frontend IPC / i18n toolkit for
iframe embedding.

## Two entry points

The SDK is a mix of server- and browser-side code, so it is split into two
sub-paths — this keeps `express` out of the frontend and `react` out of the backend:

| Import | Runs in | Contains |
|---|---|---|
| `@efa-one/sdk/backend` | Node/Express | Auth + token exchange (`requireAuth`, `createExchangeRouter`, `requireInternalOrAuth` …), health router, service discovery + gateway client (`serviceClient`, `resolveService`), clients for audit/reporting/mail/notifications, permission resolution/registration (`getUserPermissions`, `registerPermissions`, `checkPermission`), capability registry (`registerApiMetadata`), backend i18n |
| `@efa-one/sdk/frontend` | Browser/React | postMessage IPC (`registerAppInfo`, `sendAtStart`, `navigateToApp`, `notifyRouteChange` …), react-i18next factory (`initI18n`), `DevHeader` |
| `@efa-one/sdk/frontend/ui` | Browser/React | The efa-one design-system kit: `Button`, `Input`, `Badge`, `Alert`, `Dialog`, `DropdownMenu`, `Tooltip`, `EmptyState`, `Skeleton`, `RecordDialog`, and the **`DataTable`** (sortable/filterable/groupable list with per-user persisted view). Ship its companion CSS once: `import '@efa-one/sdk/frontend/ui/styles.css'` |
| `@efa-one/sdk/frontend/viewPreferences` | Browser/React | Persistence seam for `DataTable` — `createViewPreferencesClient()` (standard `/api/view-preferences/:listId` adapter) + `useViewPreferences()` |

Every individual module is also reachable directly, e.g.
`@efa-one/sdk/backend/auth` or `@efa-one/sdk/frontend/ipc`.

The `frontend/ui` kit renders against the platform design tokens (`--color-*`,
`--border-radius-*`) and expects Tailwind in the consuming app; `lucide-react` and
the `@radix-ui/*` primitives it uses are optional peer dependencies.

> **Note on legacy prefixes:** Some platform-internal identifiers (postMessage
> message types, environment variable names, JWT `iss`) still carry technical
> legacy prefixes from an earlier naming. These are part of the wire protocol
> between app and kernel and are migrated together with the kernel in one
> coordinated step — not unilaterally in the SDK.

## Installation

```bash
# in the app's backend project
npm install @efa-one/sdk express pg jsonwebtoken

# in the app's frontend project
npm install @efa-one/sdk react i18next i18next-http-backend react-i18next
```

The runtime libraries are **optional peer dependencies** — install only the ones
matching the entry point you use. The SDK itself does not bundle them.

## Usage

```ts
// Backend
import { createExchangeRouter, requireAuth, serviceClient } from '@efa-one/sdk/backend';

app.use('/api/auth', createExchangeRouter());
app.get('/api/items', requireAuth, handler);
```

```tsx
// Frontend
import { initI18n, registerAppInfo, DevHeader } from '@efa-one/sdk/frontend';

registerAppInfo({ appName: 'efa-chat', version: __APP_VERSION__ });
```

```tsx
// Frontend — a fully-featured list in a few lines
import { DataTable, type ColumnDef } from '@efa-one/sdk/frontend/ui';
import { createViewPreferencesClient } from '@efa-one/sdk/frontend/viewPreferences';
import '@efa-one/sdk/frontend/ui/styles.css';

const viewPrefs = createViewPreferencesClient({ apiBase: getApiBase }); // create once
const columns: ColumnDef<Item>[] = [
  { id: 'name', label: 'Name', accessor: (r) => r.name, filter: { type: 'text' } },
  { id: 'status', label: 'Status', accessor: (r) => r.status },
];

<DataTable listId="items.list" rows={items} columns={columns} rowKey={(r) => r.id} persistence={viewPrefs} />
```

## Build your first app

This repo ships a ready-to-copy app scaffold under [`template/`](./template) — the fastest
path to a working efa-app. It already wires up auth, health, service discovery,
audit/reporting, IPC and i18n against this SDK, so you write business logic only. No extra
tooling (and no Claude Code) required — clone the repo, then:

```bash
cp -R template efa-myapp
cd efa-myapp && rm -rf .git && git init
npm --prefix backend install && npm --prefix frontend install
docker compose up -d --build
```

See [`template/README.md`](./template/README.md) for the full walkthrough — stack variants
(3-container/PostgreSQL vs. single-container/SQLite), the intake questions, permission
registration, and the README chapters every app must keep.

## Build the SDK itself

Plain `tsc`, no bundler. Two targets:

```bash
npm install          # devDeps + peer libs for the typecheck
npm run build        # backend/ (CJS) + frontend/ (ESM), each with .d.ts
npm run typecheck    # type check only, no emit
```

- `backend/` — CommonJS (`module: commonjs`)
- `frontend/` — ESM (`module: esnext`, `moduleResolution: bundler`), marked via
  `frontend/package.json` as `{"type":"module"}`; app bundlers (Vite) consume it
  directly.

The flat output layout (`backend/` + `frontend/` at the package root) is a
deliberate choice so that consumers using `moduleResolution: node` (node10) can
resolve the subpath imports physically — without having to change their tsconfig.

## Versioning

SemVer. Consuming apps pull new versions with `npm update @efa-one/sdk`.

## License

[Apache-2.0](./LICENSE) — permissive with a patent grant, so customers and partners
can build efa-one apps without friction.
