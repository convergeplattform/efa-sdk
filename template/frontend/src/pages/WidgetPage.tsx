import React, { useEffect } from 'react';
import { AppUser } from '../types';
import { getParentOrigin, isFromPlatformParent } from '@efa-one/sdk/frontend/ipc';

interface WidgetPageProps {
  user: AppUser;
}

/**
 * WidgetPage – eingebettet als iframe in Converge-Dashboard-Kacheln.
 *
 * Auth und Theme werden per postMessage von Converge übergeben (CONVERGE_AUTH)
 * und sind über useConvergeAuth bereits verarbeitet, wenn diese Seite gerendert wird.
 *
 * Hinweise:
 * - Kein Header, kein Padding, kein Scrollbalken – Inhalt füllt die Kachelfläche aus.
 * - Im Dev-Modus (nicht im iframe + ENVIRONMENT=development) ist der DevHeader sichtbar.
 * - Alle CSS-Farben über var(--color-*) nutzen – Converge setzt diese per Theme.
 *
 * Converge sendet bei Bedarf `CONVERGE_WIDGET_REFRESH` (z. B. Refresh-Kachel oder Rückkehr
 * aus der Vollansicht). Implementiere hier eine Daten-Neuabfrage und antworte mit
 * `CONVERGE_WIDGET_REFRESH_RESULT`. Die Vorlage bestätigt ohne Daten, damit kein Timeout entsteht.
 */
export default function WidgetPage({ user: _user }: WidgetPageProps) {
  useEffect(() => {
    if (window.self === window.top) return;
    const handler = (event: MessageEvent) => {
      if (!isFromPlatformParent(event)) return;
      if (event.data?.type !== 'CONVERGE_WIDGET_REFRESH') return;
      const requestId = (event.data?.requestId as string | undefined) ?? '';
      window.parent.postMessage(
        { type: 'CONVERGE_WIDGET_REFRESH_RESULT', requestId, ok: true },
        getParentOrigin()
      );
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', padding: 0, margin: 0 }}>
      {/* Widget-Inhalt hier implementieren */}
    </div>
  );
}
