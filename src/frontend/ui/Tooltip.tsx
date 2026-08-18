import React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

// TooltipProvider must wrap your app – already included in App.tsx
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <RadixTooltip.Provider>{children}</RadixTooltip.Provider>;
}

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export function Tooltip({ content, children, side = 'top', delayDuration = 300 }: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {content}
          <RadixTooltip.Arrow className="fill-[var(--color-border)]" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
