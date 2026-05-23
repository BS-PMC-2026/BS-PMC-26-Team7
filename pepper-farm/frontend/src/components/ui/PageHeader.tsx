interface PageHeaderProps {
  label?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ label, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {label && (
          <p className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1">{label}</p>
        )}
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
