/**
 * convergeApi.ts – Global API base path for Converge apps.
 *
 * When embedded in Converge, useConvergeAuth sets the apiBase from the
 * serviceKey received via CONVERGE_AUTH postMessage (e.g. "/apps/converge_zbv").
 * In local dev mode, apiBase is empty (requests go to the local dev server).
 *
 * All app API calls should use getApiBase() to prefix their paths.
 */

let _apiBase = '';

/** Called by useConvergeAuth when the serviceKey is received */
export function setApiBase(base: string): void {
  _apiBase = base;
}

/** Returns the API base path (e.g. "/apps/converge_zbv" or "") */
export function getApiBase(): string {
  return _apiBase;
}
