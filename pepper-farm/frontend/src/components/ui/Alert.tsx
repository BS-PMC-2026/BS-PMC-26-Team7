interface AlertProps {
  children: React.ReactNode;
  variant?: 'error' | 'success' | 'info';
  className?: string;
}

const VARIANT_STYLES = {
  error:   'text-[var(--color-error)] bg-[var(--color-error-bg)] border-[var(--color-border)]',
  success: 'text-[var(--color-primary)] bg-[var(--color-secondary-light)] border-[var(--color-border)]',
  info:    'text-[var(--color-muted-foreground)] bg-white border-[var(--color-border)]',
};

export default function Alert({ children, variant = 'error', className = '' }: AlertProps) {
  return (
    <div className={`text-sm border rounded-xl px-4 py-3 ${VARIANT_STYLES[variant]} ${className}`}>
      {children}
    </div>
  );
}
