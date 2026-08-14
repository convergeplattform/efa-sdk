// Re-export everything from @efa-one/sdk/backend/auth.
// App routes import from here instead of reaching into the SDK directly.
//
// Permission-Checks (requireAdmin, requirePermission, requireAdminOrPermission,
// requireInternalOrAdminOrPermission) lösen pro Aufruf einen Live-Lookup beim
// converge_access-Service aus — Permissions stehen NICHT im JWT.
export {
  requireAuth,
  requireAdmin,
  requirePermission,
  requireAdminOrPermission,
  requireRegistryKey,
  requireInternalOrAuth,
  requireInternalOrAdminOrPermission,
  type AuthRequest,
  type JwtPayload,
  type SessionPayload,
} from '@efa-one/sdk/backend/auth';
