import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../../test/helpers/testApp';
import openapiRouter from '../../routes/openapi';

/**
 * `GET /api/openapi.json` ist der Discovery-Vertrag gegenüber dem Kernel: aus
 * dem `x-converge`-Block legt „Neue Apps suchen" Kachel, Service-Key und
 * Default-Permissions an. Bricht dieser Block, scheitert die Installation der
 * App — deshalb wird er hier festgenagelt.
 */

const app = buildTestApp('/api/openapi.json', openapiRouter);
const ORIGINAL = { SERVICE_KEY: process.env.SERVICE_KEY, APP_NAME: process.env.APP_NAME };

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('GET /api/openapi.json – Grundgerüst', () => {
  it('liefert eine OpenAPI-3.0.3-Spec als JSON', async () => {
    // Act
    const res = await request(app).get('/api/openapi.json');

    // Assert
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.openapi).toBe('3.0.3');
  });

  it('dokumentiert die Plattform-Pflichtendpunkte /health und /api/auth/exchange', async () => {
    // Act
    const res = await request(app).get('/api/openapi.json');

    // Assert
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/health', '/api/auth/exchange']),
    );
    expect(res.body.paths['/api/auth/exchange'].post.responses['401']).toBeDefined();
  });
});

describe('GET /api/openapi.json – x-converge-Block für die Kernel-Discovery', () => {
  it('übernimmt SERVICE_KEY und APP_NAME aus der Umgebung', async () => {
    // Arrange
    process.env.SERVICE_KEY = 'converge_beispiel';
    process.env.APP_NAME = 'Beispiel-App';

    // Act
    const res = await request(app).get('/api/openapi.json');

    // Assert
    expect(res.body['x-converge'].service_key).toBe('converge_beispiel');
    expect(res.body['x-converge'].display_name).toBe('Beispiel-App');
    expect(res.body.info.title).toBe('Beispiel-App');
  });

  it('fällt ohne Umgebungsvariablen auf die Template-Defaults zurück', async () => {
    // Arrange
    delete process.env.SERVICE_KEY;
    delete process.env.APP_NAME;

    // Act
    const res = await request(app).get('/api/openapi.json');

    // Assert
    expect(res.body['x-converge'].service_key).toBe('template_app');
    expect(res.body['x-converge'].display_name).toBe('Template App');
  });

  it('liefert die von der Discovery erwarteten Pflichtfelder', async () => {
    // Act
    const res = await request(app).get('/api/openapi.json');

    // Assert
    expect(res.body['x-converge']).toMatchObject({
      suggested_icon: expect.any(String),
      default_app_type: 'internal',
      default_permissions: expect.any(Array),
    });
  });
});
