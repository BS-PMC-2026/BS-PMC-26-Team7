interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Apply soft green-tint background instead of white */
  tinted?: boolean;
  /** Remove default p-6 padding for custom inner layouts */
  noPadding?: boolean;
}

/**
 * Global card surface — Pepper Farm design system.
 *
 * Default: white surface, warm green border, subtle shadow.
 * tinted=true: soft green tint (#E8F3EC) for section fills.
 * noPadding=true: removes p-6 for custom inner layouts.
 */
export default function Card({ children, className = '', tinted = false, noPadding = false }: CardProps) {
  const bg = tinted ? 'bg-[var(--color-surface-tint)]' : 'bg-[var(--color-surface)]';
  const padding = noPadding ? '' : 'p-6';

  return (
    <div className={`${bg} ${padding} rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-card)] ${className}`}>
      {children}
    </div>
  );
}
