/**
 * @efa-one/sdk/frontend/ui — das Converge Design-System-Kit.
 *
 * Barrel-Export:
 *   import { Button, DataTable, RecordDialog, type ColumnDef } from '@efa-one/sdk/frontend/ui';
 *
 * Einmal pro App die Begleit-Styles importieren (für `Badge`/`Skeleton`):
 *   import '@efa-one/sdk/frontend/ui/styles.css';
 *
 * Voraussetzung im Consumer: die Converge-Design-Tokens (`--color-*`,
 * `--border-radius-*`) im DOM + Tailwind (Radius-Mapping auf die Vars) — beides
 * liefert das App-Scaffold (`converge-tokens.css` + `tailwind.config.js`).
 */
export { Button } from './Button';
export { Input } from './Input';
export { Badge } from './Badge';
export { Alert, type AlertVariant } from './Alert';
export { Dialog, DialogClose } from './Dialog';
export * as DropdownMenu from './DropdownMenu';
export { Tooltip, TooltipProvider } from './Tooltip';
export { EmptyState } from './EmptyState';
export { Skeleton, SkeletonRow } from './Skeleton';
export { RecordDialog, type RecordDialogMode } from './RecordDialog';
export {
  DataTable,
  DEFAULT_VIEW_VERSION,
  type ColumnDef,
  type FilterDef,
  type DataTableSelectionProps,
} from './DataTable';
