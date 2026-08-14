import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="text-[var(--color-text-muted)] mb-3"><Icon className="w-10 h-10 mx-auto" /></div>
      <p className="text-base font-semibold text-[var(--color-text-primary)]">{title}</p>
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
