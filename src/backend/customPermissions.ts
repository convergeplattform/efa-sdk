/**
 * customPermissions.ts – Custom Permission Objects zur Laufzeit anlegen/löschen.
 *
 * Wann verwenden:
 *   Wenn deine App dem User erlaubt, eigene Berechtigungsobjekte über die
 *   App-UI anzulegen (z. B. Mandanten-/Projekt-spezifische Permissions wie
 *   `myapp.project_a.read`). Diese Custom-Permissions leben dann genauso in
 *   converge_access wie die im Code registrierten — sie können in der
 *   Access-UI Rollen zugewiesen werden und werden vom Live-Lookup
 *   (permissionClient/permissionCheck) ganz normal aufgelöst.
 *
 *   Für Code-Permissions, die zur Bootzeit feststehen, bleibt
 *   registerPermissions() aus permissions.ts der richtige Weg.
 *
 * Wichtig:
 *   - Diese Funktionen sind synchron (await) und werfen bei Fehler. Die App
 *     muss die UI-Aktion zurückrollen wenn der Create fehlschlägt — sonst
 *     entsteht App-DB-Drift gegenüber converge_access.
 *   - Der service_key MUSS der eigene SERVICE_KEY der App sein. Cross-App-
 *     Anlage ist nicht vorgesehen.
 *
 * Usage:
 *   import { createCustomPermission, deleteCustomPermission } from '../../template-core/customPermissions';
 *
 *   // beim Anlegen einer projektspezifischen Permission via App-UI:
 *   const { id } = await createCustomPermission({
 *     serviceKey: 'myapp',
 *     key: 'project_alpha.read',
 *     displayName: 'MyApp – Projekt Alpha lesen',
 *   });
 *   // id für spätere Verweise persistieren (App-DB).
 *
 *   // beim Löschen:
 *   await deleteCustomPermission(id);
 */

import { serviceClient } from './serviceClient';

export interface CustomPermissionInput {
  /** Service-Key der App, identisch zu SERVICE_KEY in der App-.env */
  serviceKey: string;
  /** Suffix oder Full-Key. Ohne Punkt wird mit serviceKey präfixiert. */
  key: string;
  /** Anzeigename in der Access-UI */
  displayName: string;
}

export interface CustomPermissionResult {
  id: string;
  key: string;
}

export async function createCustomPermission(
  input: CustomPermissionInput,
): Promise<CustomPermissionResult> {
  if (!input.serviceKey) throw new Error('createCustomPermission: serviceKey required');
  if (!input.key) throw new Error('createCustomPermission: key required');
  if (!input.displayName) throw new Error('createCustomPermission: displayName required');

  return serviceClient.call<CustomPermissionResult>(
    'converge_access',
    'POST',
    '/api/internal/permissions',
    {
      serviceKey: input.serviceKey,
      key: input.key,
      displayName: input.displayName,
    },
  );
}

export async function deleteCustomPermission(id: string): Promise<void> {
  if (!id) throw new Error('deleteCustomPermission: id required');
  await serviceClient.call<void>(
    'converge_access',
    'DELETE',
    `/api/internal/permissions/${encodeURIComponent(id)}`,
  );
}
