/**
 * @efa-one/sdk/frontend — Browser-seitige Integrationsschicht für efa-one-Apps.
 *
 * Enthält: postMessage-/IPC-Protokoll mit dem Kernel (CONVERGE_AUTH-Empfang,
 * GO_BACK, DeclareAppInfo, Navigation, Route-Change), react-i18next-Factory und
 * den Dev-Header.
 *
 * Barrel-Export: `import { registerAppInfo, initI18n, DevHeader } from '@efa-one/sdk/frontend'`.
 * Einzelmodule bleiben zusätzlich unter `@efa-one/sdk/frontend/<modul>` erreichbar.
 */
export * from './ipc';
export * from './i18n';
export { default as DevHeader } from './DevHeader';
