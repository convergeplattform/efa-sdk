# Service Discovery Workflow (Registry-Only)

This template uses a strict discovery-only model for cross-app integrations.

## End-to-end flow

1. Resolve service runtime target via `resolveService(serviceKey)`
2. Verify dependency status is `running`
3. Load service contract metadata via `resolveServiceDetail(serviceKey)` when endpoint discovery is needed
4. Use `baseUrlInternal` for backend-to-backend calls
5. Handle unavailable dependency explicitly (no host fallback)

## Example sequence

```ts
import { resolveService, resolveServiceDetail } from '@efa-one/sdk/backend/serviceDiscovery';

const wohnungen = await resolveService('wohnungen');
if (wohnungen.status !== 'running') {
  throw new Error('Service wohnungen unavailable');
}

const wohnungenContract = await resolveServiceDetail('wohnungen');
const openApiUrl = wohnungenContract.openApiUrl;
const capabilities = wohnungenContract.capabilities;

const response = await fetch(`${wohnungen.baseUrlInternal}/api/v1/stammdaten`);
```

## Required behavior

- Never hardcode `http://service:port`
- Never accept runtime host/port from user input
- If registry contract data is insufficient, ask follow-up questions and block assumptions
