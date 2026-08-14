import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
    />
  );
}

// Convenience: a full skeleton row (label + value)
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton width={120} height={14} />
      <Skeleton width={80} height={14} />
    </div>
  );
}
