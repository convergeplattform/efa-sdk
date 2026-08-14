// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Decoded Converge JWT payload (received via postMessage) */
export interface ConvergeJwtPayload {
  sub: string;
  name: string;
  email: string | null;
  tenant: string;
  iat: number;
  exp: number;
}

/** App-internal user (returned from /api/auth/exchange) */
export interface AppUser {
  id: string;
  convergeId: string;
  email: string | null;
  name: string;
  permissions?: string[];  // Optional: per-Request live geladen via fetchPermissions()
  createdAt?: string;
  lastSeenAt?: string | null;
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface ConvergeThemeColors {
  primary: string;
  primaryHover: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  danger: string;
  headerBg?: string;
  headerText?: string;
  headerButtonHover?: string;
}

export interface ConvergeTheme {
  id: string;
  mode: 'light' | 'dark';
  colors: ConvergeThemeColors;
}

// ─── Default dev theme ────────────────────────────────────────────────────────

export const DEV_THEME: ConvergeTheme = {
  id: 'dev-light',
  mode: 'light',
  colors: {
    primary: '#6366f1',
    primaryHover: '#4f46e5',
    secondary: '#64748b',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceRaised: '#f1f5f9',
    border: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
};
