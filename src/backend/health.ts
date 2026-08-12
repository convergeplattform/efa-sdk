import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

/**
 * createHealthRouter – returns an Express Router with:
 *   GET /health       → { status: 'ok', version }          (no auth, no DB check)
 *   GET /health/ready → { status: 'ok' | 'degraded' }      (DB connectivity check)
 *
 * Register in index.ts as: app.use('/health', createHealthRouter(pool))
 * Use these for Docker health checks, load balancers, and readiness probes.
 * Converge does NOT poll these endpoints – container status is checked via Docker socket.
 */
export function createHealthRouter(pool: Pool): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: process.env.npm_package_version ?? 'unknown',
    });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (err) {
      res.json({ status: 'degraded', error: 'Database unreachable' });
    }
  });

  return router;
}
