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
  const bg = tinted ? 'bg-[#E8F3EC]' : 'bg-white';
  const padding = noPadding ? '' : 'p-6';

  return (
    <div className={`${bg} ${padding} rounded-xl border border-[#DDE5DC] shadow-[0_2px_8px_0_rgb(26_46_34/0.07)] ${className}`}>
      {children}
    </div>
  );
}
