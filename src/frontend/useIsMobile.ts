import { useSyncExternalStore } from 'react';

/**
 * Reaktiver Media-Query-Hook für die plattformweite Mobil-Schwelle.
 *
 * `max-width: 640px` — deckungsgleich mit Tailwinds `sm`-Breakpoint, damit
 * JS-Zweige (`useIsMobile ? … : …`) und CSS-Zweige (`sm:hidden`) in einer App
 * nie auseinanderlaufen. Wer die Schwelle ändern will, ändert sie hier an EINER
 * Stelle; alle Consumer (Sidebar-Drawer, Mobil-Kopfzeilen, der Karten-Reflow
 * der {@link DataTable}) ziehen automatisch nach.
 *
 * Implementiert über `useSyncExternalStore`: SSR-sicher und ohne Flackern beim
 * ersten Paint, weil der Snapshot der aktuelle matchMedia-Zustand ist (kein
 * `useEffect`-Nachlauf). Ohne `window.matchMedia` (SSR, jsdom/happy-dom ohne
 * Stub) gilt bewusst „nicht mobil" — der Desktop-Zweig ist der verlustfreie.
 */
export const MOBILE_QUERY = '(max-width: 640px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
