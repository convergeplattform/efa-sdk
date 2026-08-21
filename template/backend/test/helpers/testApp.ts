import express, { type Router } from 'express';
import cookieParser from 'cookie-parser';

/**
 * Baut eine minimale Express-App wie `src/index.ts` (JSON-Body + cookie-parser)
 * und mountet einen Router darunter. Basis für alle supertest-basierten
 * API-Integrationstests.
 *
 * Plattform-Blueprint-Baustein (Quelle: Kernel/converge-chat, siehe TESTING.md).
 * `cookie-parser` ist hier — anders als im Kernel — Pflicht: das SDK liest die
 * Session aus `req.cookies[app_session]`, nicht aus dem rohen Cookie-Header.
 *
 * Beispiel:
 *   const app = buildTestApp('/api/items', itemsRouter);
 *   await request(app).get('/api/items').expect(200);
 */
export function buildTestApp(mountPath: string, router: Router): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(mountPath, router);
  return app;
}
