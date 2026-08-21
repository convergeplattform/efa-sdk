import { describe, it, expect } from 'vitest';
import * as appAuth from '../../middleware/auth';
import * as appAudit from '../../audit';

/**
 * `middleware/auth.ts` und `audit.ts` tragen keine eigene Logik — sie sind die
 * app-seitige Fassade vor `@efa-one/sdk`. Getestet wird deshalb genau eine Sache:
 * die EXPORT-FLÄCHE. Verschwindet oder verschiebt sich ein Symbol beim
 * SDK-Update, fällt das hier auf und nicht erst im Betrieb.
 *
 * Bewusst KEINE Verhaltenstests der Middleware — die liegen im SDK.
 */

const ERWARTETE_AUTH_EXPORTE = [
  'requireAdmin',
  'requireAdminOrPermission',
  'requireAuth',
  'requireInternalOrAdminOrPermission',
  'requireInternalOrAuth',
  'requirePermission',
  'requireRegistryKey',
];

describe('middleware/auth – Re-Export-Fläche des SDK', () => {
  it('exportiert genau die erwarteten Guards (keiner fehlt, keiner kommt dazu)', () => {
    // Act
    const exporte = Object.keys(appAuth).sort();

    // Assert
    expect(exporte).toEqual(ERWARTETE_AUTH_EXPORTE);
  });

  it('exportiert jeden Guard als Funktion', () => {
    // Assert
    for (const name of ERWARTETE_AUTH_EXPORTE) {
      expect(typeof (appAuth as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('liefert bei den Factory-Guards eine Express-Middleware zurück', () => {
    // Act
    const middleware = appAuth.requireAdminOrPermission('template_app.default');

    // Assert – (req, res, next)
    expect(typeof middleware).toBe('function');
    expect(middleware.length).toBe(3);
  });
});

describe('audit – Re-Export-Fläche des SDK', () => {
  it('exportiert logAudit als Funktion', () => {
    // Assert
    expect(Object.keys(appAudit)).toEqual(['logAudit']);
    expect(typeof appAudit.logAudit).toBe('function');
  });
});
