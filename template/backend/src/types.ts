// Re-export shared types from @efa-one/sdk
export type { JwtPayload, SessionPayload, AuthRequest } from '@efa-one/sdk/backend/auth';

// ─── App-specific types ───────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  converge_id: string;
  email: string | null;
  name: string | null;
  created_at: Date;
  last_seen_at: Date | null;
}

export interface PublicAppUser {
  id: string;
  convergeId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

export function toPublicUser(u: AppUser): PublicAppUser {
  return {
    id: u.id,
    convergeId: u.converge_id,
    email: u.email,
    name: u.name,
    createdAt: u.created_at.toISOString(),
    lastSeenAt: u.last_seen_at?.toISOString() ?? null,
  };
}
