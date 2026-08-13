import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHealthRouter } from '../src/backend/health';

function createTestApp(pool: any) {
  const app = express();
  app.use('/health', createHealthRouter(pool));
  return app;
}

describe('createHealthRouter', () => {
  describe('GET /health', () => {
    it('returns status ok', async () => {
      const pool = { query: vi.fn() };
      const app = createTestApp(pool);

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      // Should not call database
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('returns ok when database is reachable', async () => {
      const pool = { query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };
      const app = createTestApp(pool);

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(pool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns degraded when database is unreachable', async () => {
      const pool = { query: vi.fn().mockRejectedValue(new Error('Connection refused')) };
      const app = createTestApp(pool);

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.error).toBe('Database unreachable');
    });
  });
});
