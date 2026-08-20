import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

const SIZE_CLASS: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg',
  xl: 'max-w-xl', '2xl': 'max-w-2xl', '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl', '5xl': 'max-w-5xl',
};

export function Dialog({ open, onOpenChange, trigger, title, description, children, footer, size = 'md' }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}

      <RadixDialog.Portal>
        {/* Overlay */}
        <RadixDialog.Overlay className="fixed inset-0 bg-black/40 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content */}
        <RadixDialog.Content
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full ${SIZE_CLASS[size]} rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <RadixDialog.Title className="text-base font-semibold text-[var(--color-text-primary)]">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="ml-4 p-1 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors">
              <X className="w-4 h-4" />
            </RadixDialog.Close>
          </div>

          {/* Body */}
          <div className="p-5">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

// Re-export Close for use in footer buttons
export const DialogClose = RadixDialog.Close;
