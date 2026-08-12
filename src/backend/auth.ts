import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { getUserPermissions } from './permissionClient';

// Plattformweite JWT-Claims (Finding #9). Muss identisch zum Kernel
// (`backend/src/jwtClaims.ts`) sein — dort signiert, hier verifiziert. Bewusst
// ein fixer String (kein Env), damit Signierer und Prüfer nicht auseinanderdriften.
const JWT_ISSUER = 'converge';
const JWT_AUDIENCE = 'converge';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;             // Converge user UUID
  name: string;            // Eindeutiger Username (ZBV: users.name UNIQUE NOT NULL)
  email: string | null;
  language?: string;
  tenant: string;
  iat: number;
  exp: number;
  forcePasswordChange?: boolean;
}

export interface SessionPayload {
  sub: string;        // app_users.id (UUID)
  convergeId: string; // app_users.converge_id (= JwtPayload.sub)
  name: string;       // Eindeutiger Username
  email: string | null;
  language?: string;
  tenant: string;
}

export interface AuthRequest extends Request {
  user?: SessionPayload;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConvergePublicKey(): string {
  const s = process.env.JWT_PUBLIC_KEY;
  if (!s) throw new Error('JWT_PUBLIC_KEY environment variable is required');
  return Buffer.from(s, 'base64').toString('utf8');
}

function getSessionSecret(): string {
  const s = process.env.APP_SESSION_SECRET;
  if (!s) throw new Error('APP_SESSION_SECRET environment variable is required');
  return s;
}

function getCookieName(): string {
  return process.env.APP_SESSION_COOKIE_NAME || 'app_session';
}

function setSessionCookie(res: Response, token: string): void {
  // secure-Flag (Finding #7): explizites COOKIE_SECURE gewinnt, sonst automatisch
  // in Produktion an. Verhindert, dass der app_session-Cookie in Prod über HTTP
  // ausgeliefert wird, wenn COOKIE_SECURE vergessen wurde. sameSite:'lax' blockt
  // Cross-Site-POST-Cookies (CSRF-Grundschutz).
  const secure = process.env.COOKIE_SECURE
    ? ['1', 'true', 'yes', 'on'].includes(process.env.COOKIE_SECURE.toLowerCase())
    : process.env.NODE_ENV === 'production';
  res.cookie(getCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    secure,
    path: '/',
  });
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * requireAuth – reads the httpOnly app_session cookie (signed with APP_SESSION_SECRET).
 * Attaches decoded payload to req.user. Synchronous — only verifies the JWT.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[getCookieName()];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    // Algorithmus-Pin (Finding #9): app_session ist HS256 (symmetrisch). Ohne Pin
    // würde jwt.verify jeden im Token deklarierten Algorithmus akzeptieren — inkl.
    // RS/ES-„alg-confusion". Der Cookie wird nur gegen sich selbst validiert.
    const payload = jwt.verify(token, getSessionSecret(), { algorithms: ['HS256'] }) as SessionPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Session invalid or expired' });
  }
}

/**
 * requireAdmin – requireAuth + Live-Lookup gegen converge_access.
 * Erlaubt nur User mit Permission `converge-admin`.
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    getUserPermissions(req.user!.convergeId)
      .then((keys) => {
        if (!keys.includes('converge-admin')) {
          res.status(403).json({ error: 'Admin access required' });
          return;
        }
        next();
      })
      .catch((err) => {
        console.error(JSON.stringify({ level: 'error', msg: 'requireAdmin: permission lookup failed', err: String(err) }));
        res.status(503).json({ error: 'Permission service unavailable' });
      });
  });
}

/**
 * requirePermission – requireAuth + Live-Lookup gegen converge_access.
 * Erlaubt User mit dem angegebenen Permission-Key. converge-admin ist KEIN Bypass —
 * für Admin-Bypass siehe requireAdminOrPermission.
 */
export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      getUserPermissions(req.user!.convergeId)
        .then((keys) => {
          if (!keys.includes(permission)) {
            res.status(403).json({ error: `Permission required: ${permission}` });
            return;
          }
          next();
        })
        .catch((err) => {
          console.error(JSON.stringify({ level: 'error', msg: 'requirePermission: permission lookup failed', err: String(err) }));
          res.status(503).json({ error: 'Permission service unavailable' });
        });
    });
  };
}

/**
 * requireAdminOrPermission – akzeptiert Converge-Admins (Permission `converge-admin`)
 * ODER User mit mindestens einem der angegebenen Permission-Keys.
 * Standard-Middleware für App-Routen — Admins kommen überall durch.
 */
export function requireAdminOrPermission(...permissionKeys: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      getUserPermissions(req.user!.convergeId)
        .then((keys) => {
          if (keys.includes('converge-admin')) {
            next();
            return;
          }
          if (permissionKeys.some((k) => keys.includes(k))) {
            next();
            return;
          }
          res.status(403).json({ error: 'Forbidden – missing permission' });
        })
        .catch((err) => {
          console.error(JSON.stringify({ level: 'error', msg: 'requireAdminOrPermission: permission lookup failed', err: String(err) }));
          res.status(503).json({ error: 'Permission service unavailable' });
        });
    });
  };
}

// Provenance: der Converge-Gateway mintet nach erfolgreicher Caller-Auth ein
// kurzlebiges RS256-Token (`X-Service-Token`), das kryptografisch beweist, dass
// der Request durch den Gateway von einem authentifizierten Service kam. Wir
// verifizieren es mit dem vorhandenen JWT_PUBLIC_KEY. `iss='converge-gateway'`
// grenzt es sauber von User-Tokens (`iss='converge'`) ab; `aud` muss der eigene
// SERVICE_KEY sein (Gateway hat aud = Ziel-serviceKey gesetzt). Ersetzt den
// vormals geteilten REGISTRY_API_KEY-String-Vergleich.
const PROVENANCE_ISSUER = 'converge-gateway';

/** true, wenn ein gültiges Provenance-Token für DIESEN Service vorliegt. */
function hasValidServiceProvenance(req: Request): boolean {
  const token = req.headers['x-service-token'] as string | undefined;
  if (!token) return false;
  const audience = process.env.SERVICE_KEY;
  if (!audience) return false;
  try {
    jwt.verify(token, getConvergePublicKey(), {
      algorithms: ['RS256'],
      issuer: PROVENANCE_ISSUER,
      audience,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * requireRegistryKey – Service-zu-Service-Auth.
 * Schützt /api/internal/*-Endpunkte. Nur Aufrufe mit gültigem
 * Gateway-Provenance-Token (`X-Service-Token`) für diesen Service passieren.
 */
export function requireRegistryKey(req: Request, res: Response, next: NextFunction): void {
  if (hasValidServiceProvenance(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Service provenance token required' });
}

/**
 * requireInternalOrAuth – akzeptiert ein gültiges Gateway-Provenance-Token
 * (Service-to-Service) ODER ein gültiges App-Session-JWT.
 */
export function requireInternalOrAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (hasValidServiceProvenance(req)) {
    next();
    return;
  }
  requireAuth(req, res, next);
}

/**
 * requireInternalOrAdminOrPermission – akzeptiert ein Gateway-Provenance-Token,
 * Converge-Admin oder eine der angegebenen App-Permissions. Live-Lookup für die
 * User-Variante.
 */
export function requireInternalOrAdminOrPermission(...permissionKeys: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (hasValidServiceProvenance(req)) {
      next();
      return;
    }
    requireAdminOrPermission(...permissionKeys)(req, res, next);
  };
}

// ─── Token Exchange Router ────────────────────────────────────────────────────

/**
 * createExchangeRouter – mounts POST /exchange.
 * Register in index.ts as: app.use('/api/auth', createExchangeRouter(pool))
 *
 * Flow:
 *   1. Validates incoming Converge JWT (RS256 via JWT_PUBLIC_KEY)
 *   2. Auto-provisions user in app_users table
 *   3. Issues own session JWT (APP_SESSION_SECRET) as httpOnly cookie
 *   4. Returns { user }
 *
 * Permissions liegen NICHT mehr im Session-JWT — Apps fragen pro Request beim
 * converge_access-Service nach (siehe permissionClient.ts).
 */
export function createExchangeRouter(pool: Pool): Router {
  const router = Router();

  router.post('/exchange', async (req: Request, res: Response) => {
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ error: 'token required' });
      return;
    }

    let convergePayload: JwtPayload;
    try {
      // Algorithmus + iss/aud pinnen (Finding #9): nur RS256-Tokens, die der
      // Kernel als Converge-Plattform-Token ausgestellt hat, werden akzeptiert.
      convergePayload = jwt.verify(token, getConvergePublicKey(), {
        algorithms: ['RS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as JwtPayload;
    } catch {
      res.status(401).json({ error: 'Invalid or expired Converge token' });
      return;
    }

    try {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO app_users (converge_id, email, name, last_seen_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (converge_id) DO UPDATE
           SET last_seen_at = NOW(),
               email = EXCLUDED.email,
               name = EXCLUDED.name
         RETURNING id`,
        [
          convergePayload.sub,
          convergePayload.email ?? null,
          convergePayload.name,
        ],
      );

      const appUser = rows[0];

      const sessionPayload: SessionPayload = {
        sub: appUser.id,
        convergeId: convergePayload.sub,
        name: convergePayload.name,
        email: convergePayload.email ?? null,
        language: convergePayload.language,
        tenant: convergePayload.tenant,
      };

      const sessionToken = jwt.sign(sessionPayload, getSessionSecret(), { algorithm: 'HS256', expiresIn: '8h' });
      setSessionCookie(res, sessionToken);

      res.json({
        user: {
          id: appUser.id,
          convergeId: convergePayload.sub,
          name: convergePayload.name,
          email: convergePayload.email ?? null,
          tenant: convergePayload.tenant,
        },
      });
    } catch (err) {
      console.error(JSON.stringify({ level: 'error', msg: 'Exchange error', err: String(err) }));
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie(getCookieName());
    res.json({ ok: true });
  });

  // Live-Lookup für Frontend-UI-Checks (z.B. Admin-Abzeichen, Settings-Icon).
  // App-Backend-Routen sollen requireAdmin/requirePermission verwenden — die machen
  // ihren eigenen Live-Lookup. Diese Route ist nur für Frontend-UI.
  router.get('/permissions', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const keys = await getUserPermissions(req.user!.convergeId);
      res.json({ keys });
    } catch (err) {
      console.error(JSON.stringify({ level: 'error', msg: 'Permissions lookup failed', err: String(err) }));
      res.status(503).json({ error: 'Permission service unavailable' });
    }
  });

  return router;
}
