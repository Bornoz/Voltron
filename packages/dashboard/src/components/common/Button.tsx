import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const variantStyles = {
  primary: 'bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white border-blue-500/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
  danger: 'bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-red-500/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
  success: 'bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white border-green-500/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]',
  ghost: 'bg-white/[0.03] hover:bg-white/[0.06] text-gray-300 border-white/[0.06]',
};

const sizeStyles = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40',
          'active:scale-[0.98]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          variantStyles[variant],
          sizeStyles[size],
        ),
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
