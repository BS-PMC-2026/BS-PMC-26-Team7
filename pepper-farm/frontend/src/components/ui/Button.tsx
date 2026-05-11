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
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variants = {
    primary:   'bg-[#2F6F4E] text-white hover:bg-[#245C3F]',
    secondary: 'bg-[#6FA36F] text-white hover:bg-[#5C8F5C]',
    danger:    'bg-[#D64545] text-white hover:bg-[#B83939]',
    outline:   'bg-transparent text-[#2F6F4E] border border-[#2F6F4E] hover:bg-[#D6EBE0]',
    ghost:     'bg-transparent text-[#2F6F4E] hover:bg-[#EEF0EC]',
  };

  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
