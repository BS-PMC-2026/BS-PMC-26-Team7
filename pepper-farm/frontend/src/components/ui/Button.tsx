import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Global button primitive — Pepper Farm design system.
 *
 * Variants:
 *   primary   → deep green (#2F6F4E)
 *   secondary → olive green (#6FA36F)
 *   danger    → pepper red (#D64545)
 *   outline   → bordered, transparent bg
 *   ghost     → no border, subtle hover fill
 *
 * Sizes: sm | md (default) | lg
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] transition-colors duration-[var(--transition-fast)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variants = {
    primary:   'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
    secondary: 'bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-hover)]',
    danger:    'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]',
    outline:   'bg-transparent text-[var(--color-primary)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]',
    ghost:     'bg-transparent text-[var(--color-primary)] hover:bg-[var(--color-muted)]',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
