import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { requireAuth, requireAdmin, requirePermission, requireAdminOrPermission, createExchangeRouter } from '../src/backend/auth';
import type { Response } from 'express';
import type { AuthRequest, SessionPayload } from '../src/backend/auth';
import express from 'express';
import request from 'supertest';

const APP_SESSION_SECRET = 'test-app-session-secret';

const { privateKey: rsaPrivateKey, publicKey: rsaPublicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const JWT_PUBLIC_KEY_B64 = Buffer.from(rsaPublicKey).toString('base64');

const getUserPermissionsMock = vi.fn();
vi.mock('../src/backend/permissionClient', () => ({
  getUserPermissions: (...args: unknown[]) => getUserPermissionsMock(...args),
}));

beforeEach(() => {
  vi.stubEnv('APP_SESSION_SECRET', APP_SESSION_SECRET);
  vi.stubEnv('JWT_PUBLIC_KEY', JWT_PUBLIC_KEY_B64);
  getUserPermissionsMock.mockReset();
});

function makeSessionToken(payload: Partial<SessionPayload> = {}): string {
  const defaults: SessionPayload = {
    sub: 'user-123',
    convergeId: 'converge-456',
    name: 'testuser',
    email: 'test@example.com',
    tenant: 'default',
  };
  return jwt.sign({ ...defaults, ...payload }, APP_SESSION_SECRET, { expiresIn: '1h' });
}

function makeConvergeToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      sub: 'converge-456',
      name: 'testuser',
      email: 'test@example.com',
      tenant: 'default',
      ...overrides,
    },
    rsaPrivateKey,
    // iss/aud müssen zum gehärteten Exchange-Verifier passen (Finding #9).
    { algorithm: 'RS256', expiresIn: '1h', issuer: 'converge', audience: 'converge' },
  );
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// ─── requireAuth ────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('returns 401 when no cookie present', () => {
    const req = { cookies: {} } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when cookie has invalid token', () => {
    const req = { cookies: { app_session: 'garbage' } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', () => {
    const expired = jwt.sign({ sub: 'x', convergeId: 'y', name: 'x', email: null, tenant: 'default' }, APP_SESSION_SECRET, {
      expiresIn: '-1s',
    });
    const req = { cookies: { app_session: expired } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.user and calls next on valid token', () => {
    const token = makeSessionToken();
    const req = { cookies: { app_session: token } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.convergeId).toBe('converge-456');
    expect(req.user!.name).toBe('testuser');
    expect(req.user!.email).toBe('test@example.com');
  });
});

// ─── requireAdmin ───────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  it('returns 403 when user lacks converge-admin permission', async () => {
    getUserPermissionsMock.mockResolvedValueOnce(['myapp.default']);
    const token = makeSessionToken();
    const req = { cookies: { app_session: token } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);
    await flushAsync();
    await flushAsync();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user has converge-admin permission', async () => {
    getUserPermissionsMock.mockResolvedValueOnce(['converge-admin']);
    const token = makeSessionToken();
    const req = { cookies: { app_session: token } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);
    await flushAsync();
    await flushAsync();

    expect(next).toHaveBeenCalled();
  });
});

// ─── requirePermission ──────────────────────────────────────────────────────

describe('requirePermission', () => {
  it('returns 403 when user lacks the permission', async () => {
    getUserPermissionsMock.mockResolvedValueOnce(['myapp.default']);
    const token = makeSessionToken();
    const req = { cookies: { app_session: token } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requirePermission('myapp.admin')(req, res, next);
    await flushAsync();
    await flushAsync();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user has the permission', async () => {
    getUserPermissionsMock.mockResolvedValueOnce(['myapp.default', 'myapp.admin']);
    const token = makeSessionToken();
    const req = { cookies: { app_session: token } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requirePermission('myapp.admin')(req, res, next);
    await flushAsync();
    await flushAsync();

    expect(next).toHaveBeenCalled();
  });
});

// ─── requireAdminOrPermission ───────────────────────────────────────────────

describe('requireAdminOrPermission', () => {
  it('allows admin via converge-admin', async () => {
    getUserPermissionsMock.mockResolvedValueOnce(['converge-admin']);
    const token = makeSessionToken();
    const req = { cookies: { app_session: token } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAdminOrPermission('myapp.admin')(req, res, next);
    await flushAsync();
    await flushAsync();

    expect(next).toHaveBeenCalled();
  });

  it('allows user with one of the listed permissions', async () => {
    getUserPermissionsMock.mockResolvedValueOnce(['myapp.write']);
    const token = makeSessionToken();
    const req = { cookies: { app_session: token } } as AuthRequest;
    const res = mockRes();
    const next = vi.fn();

    requireAdminOrPermission('myapp.admin', 'myapp.write')(req, res, next);
    await flushAsync();
    await flushAsync();

    expect(next).toHaveBeenCalled();
  });
});

// ─── Token Exchange ─────────────────────────────────────────────────────────

describe('createExchangeRouter', () => {
  function createTestApp(pool: any) {
    const app = express();
    app.use(express.json());
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());
    app.use('/api/auth', createExchangeRouter(pool));
    return app;
  }

  it('returns 400 when token is missing', async () => {
    const pool = { query: vi.fn() };
    const app = createTestApp(pool);

    const res = await request(app).post('/api/auth/exchange').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('token required');
  });

  it('returns 401 when converge token is invalid', async () => {
    const pool = { query: vi.fn() };
    const app = createTestApp(pool);

    const res = await request(app).post('/api/auth/exchange').send({ token: 'invalid' });

    expect(res.status).toBe(401);
  });

  it('creates user and returns session on valid converge token', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 'app-user-789' }],
      }),
    };
    const app = createTestApp(pool);
    const convergeToken = makeConvergeToken();

    const res = await request(app).post('/api/auth/exchange').send({ token: convergeToken });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.convergeId).toBe('converge-456');
    expect(res.body.user.name).toBe('testuser');
    // Permissions stehen NICHT im Exchange-Response — Apps fragen sie per Live-Lookup
    expect(res.body.user.permissions).toBeUndefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('app_session=');
    expect(cookies[0]).toContain('HttpOnly');

    expect(pool.query).toHaveBeenCalledOnce();
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO app_users');
    expect(sql).toContain('ON CONFLICT');
    expect(params[0]).toBe('converge-456');
    expect(params[2]).toBe('testuser');
  });

  it('logout clears cookie', async () => {
    const pool = { query: vi.fn() };
    const app = createTestApp(pool);

    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
