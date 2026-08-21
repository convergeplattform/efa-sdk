import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../../test/helpers/testApp';

/**
 * `/health` und `/health/ready` sind der Docker-HEALTHCHECK der App. Getestet
 * wird der echte Router-Stack (supertest) mit gemocktem DB-Pool — inklusive des
 * Falls „DB weg", bei dem der Endpoint bewusst 200 mit `degraded` liefert statt
 * 5xx (sonst würde Docker den Container hart neu starten).
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock('../../db', () => ({ pool: { query: mockQuery } }));

import healthRouter from '../../routes/health';

const app = buildTestApp('/health', healthRouter);
const ORIGINAL_VERSION = process.env.npm_package_version;

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
});

afterEach(() => {
  if (ORIGINAL_VERSION === undefined) delete process.env.npm_package_version;
  else process.env.npm_package_version = ORIGINAL_VERSION;
});

describe('GET /health – Liveness', () => {
  it('antwortet mit 200 und status ok, ohne die Datenbank anzufassen', async () => {
    // Act
    const res = await request(app).get('/health');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('gibt die Paketversion aus npm_package_version zurück', async () => {
    // Arrange
    process.env.npm_package_version = '4.2.0';

    // Act
    const res = await request(app).get('/health');

    // Assert
    expect(res.body.version).toBe('4.2.0');
  });

  it('gibt "unknown" zurück, wenn keine Paketversion im Prozess steht', async () => {
    // Arrange
    delete process.env.npm_package_version;

    // Act
    const res = await request(app).get('/health');

    // Assert
    expect(res.body.version).toBe('unknown');
  });
});

describe('GET /health/ready – Readiness mit DB-Prüfung', () => {
  it('antwortet mit status ok, wenn die DB-Prüfquery durchläuft', async () => {
    // Act
    const res = await request(app).get('/health/ready');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(mockQuery).toHaveBeenCalledExactlyOnceWith('SELECT 1');
  });

  it('antwortet mit 200 und status degraded, wenn die DB nicht erreichbar ist', async () => {
    // Arrange – 200 ist Absicht: ein 5xx würde den Docker-HEALTHCHECK zum
    // Neustart des Containers bewegen, obwohl nur die DB fehlt.
    mockQuery.mockRejectedValue(new Error('connection refused'));

    // Act
    const res = await request(app).get('/health/ready');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'degraded', error: 'Database unreachable' });
  });
});
