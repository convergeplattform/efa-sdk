import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { buildTestApp } from '../../../test/helpers/testApp';
import { makeRsaKeypair } from '../../../test/factories';
import devRouter from '../../routes/dev';

/**
 * `/dev/token` stellt lokal ein Plattform-JWT aus, damit man die App ohne
 * laufenden Kernel benutzen kann. Sicherheitsrelevant: die Route darf in
 * Produktion NICHT antworten (der Doppel-Guard im Router ist die letzte
 * Verteidigungslinie, falls jemand den if-Block in index.ts umgeht).
 */

const app = buildTestApp('/dev', devRouter);
const keys = makeRsaKeypair();
const ORIGINAL = {
  ENVIRONMENT: process.env.ENVIRONMENT,
  JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY,
};

beforeAll(() => {
  // dev.ts erwartet den Key base64-kodiert, genau wie der Kernel ihn liefert.
  process.env.JWT_PRIVATE_KEY = keys.privateKeyB64;
});

beforeEach(() => {
  delete process.env.ENVIRONMENT;
  process.env.JWT_PRIVATE_KEY = keys.privateKeyB64;
});

afterAll(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('GET /dev/token – Schutz in Produktion', () => {
  it('antwortet mit 404, wenn ENVIRONMENT=production gesetzt ist', async () => {
    // Arrange
    process.env.ENVIRONMENT = 'production';

    // Act
    const res = await request(app).get('/dev/token');

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

describe('GET /dev/token – Fehlkonfiguration', () => {
  it('antwortet mit 500 und Hinweis, wenn JWT_PRIVATE_KEY fehlt', async () => {
    // Arrange
    delete process.env.JWT_PRIVATE_KEY;

    // Act
    const res = await request(app).get('/dev/token');

    // Assert
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/JWT_PRIVATE_KEY not set/);
  });
});

describe('GET /dev/token – ausgestelltes Token', () => {
  it('liefert ein Token, das mit dem Public Key der Plattform verifizierbar ist', async () => {
    // Act
    const res = await request(app).get('/dev/token');

    // Assert
    expect(res.status).toBe(200);
    const payload = jwt.verify(res.body.token, keys.publicKeyPem, {
      algorithms: ['RS256'],
      issuer: 'converge',
      audience: 'converge',
    }) as Record<string, unknown>;
    expect(payload).toMatchObject({ sub: 'dev-user-001', name: 'dev', email: 'dev@local', tenant: 'default' });
  });

  it('signiert mit RS256 und den Plattform-Claims iss/aud=converge', async () => {
    // Act
    const res = await request(app).get('/dev/token');

    // Assert – Header und Claims ohne Verifikation lesen.
    const decoded = jwt.decode(res.body.token, { complete: true });
    expect(decoded?.header.alg).toBe('RS256');
    expect((decoded?.payload as Record<string, unknown>).iss).toBe('converge');
    expect((decoded?.payload as Record<string, unknown>).aud).toBe('converge');
  });

  it('setzt eine Laufzeit von 8 Stunden (wie der Kernel-Login)', async () => {
    // Act
    const res = await request(app).get('/dev/token');

    // Assert – Differenz statt Absolutwert, damit der Test nicht an der Uhr hängt.
    const payload = jwt.decode(res.body.token) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
  });

  it('trägt KEINE Permissions im Token (die kommen live vom Kernel)', async () => {
    // Act
    const res = await request(app).get('/dev/token');

    // Assert
    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload.permissions).toBeUndefined();
    expect(payload.roles).toBeUndefined();
  });
});
