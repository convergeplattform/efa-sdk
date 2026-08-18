import React from 'react';
import { X } from 'lucide-react';

export type AlertVariant = 'error' | 'success' | 'warning' | 'info';

interface AlertProps {
  /** Farbschema. Default: `error`. */
  variant?: AlertVariant;
  /** Meldungstext (oder beliebiger Inhalt). */
  children: React.ReactNode;
  /**
   * Wenn gesetzt, erscheint rechts ein „×"-Button, der diesen Callback aufruft.
   * Ohne `onDismiss` ist das Banner nicht manuell schließbar.
   */
  onDismiss?: () => void;
  className?: string;
}

// Jede Variante nutzt EINE CSS-Farbvariable für Rahmen + Text und eine
// 10%-Tönung derselben Farbe als Fläche (via color-mix). Dadurch ist der Text
// IMMER lesbar — nie „Text in derselben Farbe wie die Fläche". Niemals
// `bg-opacity-*`/`border-opacity-*` auf eine `bg-[var(--…)]`-Arbitrary anwenden:
// diese Utilities wirken dort nicht, die Fläche bleibt vollflächig → Rot-auf-Rot.
const VARIANT: Record<AlertVariant, string> = {
  error:
    'bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border-[var(--color-danger)] text-[var(--color-danger)]',
  success:
    'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border-[var(--color-success)] text-[var(--color-success)]',
  warning:
    'bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] border-[var(--color-warning)] text-[var(--color-warning)]',
  info:
    'bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] border-[var(--color-primary)] text-[var(--color-primary)]',
};

/**
 * Fehler-/Status-Banner für Formulare und Dialoge.
 *
 * WICHTIG zur Platzierung: In einem scrollenden Formular/Dialog gehört das Banner
 * an das obere Ende des Bodys **außerhalb des scrollenden Bereichs** (z. B. als
 * `shrink-0`-Kind vor dem `overflow-y-auto`-Container). Sonst scrollt es weg und
 * ist beim Klick auf einen Submit-Button, der weiter unten liegt, nicht sichtbar.
 * Beim erneuten Validieren `setError('')` setzen, damit alte Meldungen verschwinden.
 */
export function Alert({ variant = 'error', children, onDismiss, className = '' }: AlertProps) {
  return (
    <div
      role="alert"
      className={`shrink-0 flex items-start gap-2 border rounded-md px-4 py-3 text-sm font-medium ${VARIANT[variant]} ${className}`}
    >
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Meldung schließen"
          className="shrink-0 -mr-1 p-0.5 rounded hover:bg-current/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
