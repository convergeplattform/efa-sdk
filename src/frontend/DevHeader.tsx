import React from 'react';

interface DevHeaderProps {
  appName: string;
  onBack: () => void;
  onSettings: () => void;
}

/**
 * DevHeader – shown ONLY when the app runs outside an iframe (local dev mode).
 * Simulates the Converge header for local navigation testing.
 * Automatically returns null when embedded in Converge.
 *
 * Do NOT modify this file. It is part of template-core.
 */
export default function DevHeader({ appName, onBack, onSettings }: DevHeaderProps) {
  // When embedded in Converge, Converge provides the real header
  if (window.self !== window.top) return null;

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 16px',
        height: '52px',
        background: '#1e293b',
        color: '#f1f5f9',
        flexShrink: 0,
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
      }}
    >
      {/* DEV MODE badge */}
      <span
        style={{
          background: '#f59e0b',
          color: '#1c1917',
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: '4px',
          letterSpacing: '0.05em',
          flexShrink: 0,
        }}
      >
        DEV MODE
      </span>

      {/* Back button */}
      <button
        onClick={onBack}
        title="Back to dashboard"
        style={{
          background: 'transparent',
          border: '1px solid #475569',
          color: '#94a3b8',
          borderRadius: '6px',
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        ← Back
      </button>

      {/* App name */}
      <span style={{ fontWeight: 600, color: '#f1f5f9', flex: 1 }}>{appName}</span>

      {/* Settings gear */}
      <button
        onClick={onSettings}
        title="Settings"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: '18px',
          padding: '4px 8px',
          borderRadius: '6px',
        }}
      >
        ⚙
      </button>
    </header>
  );
}
