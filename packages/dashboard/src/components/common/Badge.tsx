import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RiskLevel } from '@voltron/shared';

const riskStyles: Record<RiskLevel, string> = {
  NONE: 'bg-gray-700 text-gray-300 border-gray-600',
  LOW: 'bg-green-900/50 text-green-400 border-green-700',
  MEDIUM: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
  HIGH: 'bg-orange-900/50 text-orange-400 border-orange-700',
  CRITICAL: 'bg-red-900/50 text-red-400 border-red-700 animate-pulse',
};

interface BadgeProps {
  risk: RiskLevel;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ risk, size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-semibold border rounded-full uppercase tracking-wider',
          riskStyles[risk],
          size === 'sm' && 'px-2 py-0.5 text-[10px]',
          size === 'md' && 'px-2.5 py-1 text-xs',
        ),
        className,
      )}
    >
      {risk}
    </span>
  );
}
