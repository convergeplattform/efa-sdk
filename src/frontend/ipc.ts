/**
 * ipc.ts – postMessage helpers for communication with the Converge parent frame.
 *
 * Converge listens for these messages from embedded apps and reacts accordingly.
 * All functions are no-ops when the app is not embedded in an iframe.
 *
 * Usage:
 *   import { sendAtStart } from '../../template-core/ipc';
 *
 *   // Call when the user navigates to the app's root/start state.
 *   // Converge will show the "back to dashboard" button and reset history.
 *   sendAtStart();
 */

/** Returns true when the app is running inside a Converge iframe. */
function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return false;
  }
}

/**
 * Signals to Converge that the app has returned to its start/root state.
 * Converge responds by navigating back to the dashboard and resetting its history.
 *
 * Call this whenever the user navigates back to the app's top-level view,
 * e.g. on a back-button handler that reaches the root route.
 */
/**
 * Returns the parent Converge origin for secure postMessage communication.
 * Never returns '*': falls back to the app's own origin if the parent origin
 * cannot be determined (e.g. Firefox has no `ancestorOrigins`). A mismatch then
 * makes the browser silently drop the message — which is the safe failure mode,
 * versus broadcasting to an arbitrary embedder with '*'.
 */
export function getParentOrigin(): string {
  try {
    return window.location.ancestorOrigins?.[0] ?? window.location.origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * Guard for INBOUND postMessage handlers: true only when the message came from
 * the frame that directly embedded us (the Converge kernel).
 *
 * Every `window.addEventListener('message', …)` handler that acts on Converge
 * messages (CONVERGE_AUTH, CONVERGE_GO_BACK, CONVERGE_WIDGET_REFRESH, …) MUST
 * gate on this. Without it, any sibling iframe (e.g. an ad frame) or a
 * `window.opener` on the page can forge those messages — including CONVERGE_AUTH,
 * which carries the login token (session-fixation vector).
 *
 * Note: this stops sibling/opener injection. It does NOT by itself stop a
 * malicious *top-level* page from embedding the app and posting as the parent —
 * that is closed separately by a `frame-ancestors` CSP / X-Frame-Options on the
 * app's own responses (server/nginx layer), not here.
 */
export function isFromPlatformParent(event: MessageEvent): boolean {
  return event.source === window.parent;
}

export function sendAtStart(): void {
  if (!isEmbedded()) return;
  window.parent.postMessage({ type: 'CONVERGE_AT_START' }, getParentOrigin());
}

/**
 * @deprecated Use `registerAppInfo` instead. This fires exactly once and carries
 * no `serviceKey`, so the kernel cannot tell it apart from a stale declaration of
 * a previously open app (all apps share one origin). The kernel ignores payloads
 * without a matching `serviceKey`, so this call no longer sets the header version.
 *
 * Declares the app's identity to Converge so it can be shown in the kernel help modal.
 */
export function sendDeclareAppInfo(payload: { appName: string; version: string }): void {
  if (!isEmbedded()) return;
  window.parent.postMessage(
    { type: 'CONVERGE_DECLARE_APP_INFO', payload },
    getParentOrigin(),
  );
}

/**
 * Builds the outbound CONVERGE_DECLARE_APP_INFO message from an inbound
 * CONVERGE_AUTH message's data, tagging it with the `serviceKey` the kernel sent.
 * Returns null when the data is not a CONVERGE_AUTH carrying a string serviceKey.
 *
 * Pure (no DOM access) so the correlation logic is unit-testable. The kernel
 * accepts the declaration only when this `serviceKey` matches the currently
 * framed tile — which is why re-declaring on every auth (not once at mount) keeps
 * the header correct across app switches, back/forward and bfcache restores.
 */
export function appInfoDeclareFromAuth(
  info: { appName: string; version: string },
  data: unknown,
): { type: 'CONVERGE_DECLARE_APP_INFO'; payload: { appName: string; version: string; serviceKey: string } } | null {
  const d = data as { type?: unknown; serviceKey?: unknown } | null;
  if (!d || d.type !== 'CONVERGE_AUTH' || typeof d.serviceKey !== 'string') return null;
  return {
    type: 'CONVERGE_DECLARE_APP_INFO',
    payload: { appName: info.appName, version: info.version, serviceKey: d.serviceKey },
  };
}

/**
 * Registers the app's identity with Converge and keeps it in sync.
 *
 * Call once at app start with the human-readable app name and current build
 * version. It listens for CONVERGE_AUTH from the platform parent and, on every
 * such message, re-declares the app info tagged with the `serviceKey` the kernel
 * sent. Because the kernel re-sends CONVERGE_AUTH on every open (and after
 * back/forward / bfcache restore), the header always reflects the app that is
 * actually framed — never a previously opened one.
 *
 * Returns an unsubscribe function; return it from a mount effect for cleanup.
 * No-op (returns a no-op unsubscribe) when the app is not embedded.
 */
export function registerAppInfo(info: { appName: string; version: string }): () => void {
  if (!isEmbedded()) return () => {};
  const handler = (event: MessageEvent) => {
    if (!isFromPlatformParent(event)) return;
    const message = appInfoDeclareFromAuth(info, event.data);
    if (message) window.parent.postMessage(message, getParentOrigin());
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

/**
 * Asks the Converge kernel to open ANOTHER app (by service_key) in the shell.
 * The kernel opens the target tile — or, if the user does not have it visible,
 * a virtual tile (`/apps/{serviceKey}/`). Access control is preserved: the
 * target app enforces its own permission gates server-side.
 *
 * Example: navigateToApp('converge_textbausteine')
 */
export function navigateToApp(serviceKey: string, options?: { path?: string }): void {
  if (!isEmbedded()) return;
  window.parent.postMessage(
    { type: 'CONVERGE_NAVIGATE_TO_APP', payload: { serviceKey, path: options?.path } },
    getParentOrigin(),
  );
}

/**
 * Notifies the Converge kernel that the embedded app's inner route changed, so
 * the kernel keeps its address-bar URL in sync — enabling shareable deep-links
 * (`#/app/<serviceKey>/<innerPath>`). No-op when not embedded.
 *
 * Call from a router location effect, e.g. with react-router:
 *   const location = useLocation();
 *   useEffect(() => { notifyRouteChange(location.pathname); }, [location.pathname]);
 */
export function notifyRouteChange(path: string): void {
  if (!isEmbedded()) return;
  window.parent.postMessage({ type: 'CONVERGE_ROUTE_CHANGED', path }, getParentOrigin());
}
