import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  padding?: boolean;
  className?: string;
  headerRight?: ReactNode;
}

export function Card({ title, children, padding = true, className, headerRight }: CardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-xl overflow-hidden transition-colors',
          'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
        ),
        className,
      )}
      style={{ boxShadow: 'var(--shadow-card)', border: '1px solid var(--glass-border)' }}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </h3>
          {headerRight}
        </div>
      )}
      <div className={clsx(padding && 'p-4')}>{children}</div>
    </div>
  );
}
