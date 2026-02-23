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
        clsx('rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden'),
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
            {title}
          </h3>
          {headerRight}
        </div>
      )}
      <div className={clsx(padding && 'p-4')}>{children}</div>
    </div>
  );
}
