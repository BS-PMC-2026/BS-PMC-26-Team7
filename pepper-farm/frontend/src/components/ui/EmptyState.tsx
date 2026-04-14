interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
}

export default function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {icon && <span className="text-5xl mb-4 opacity-20">{icon}</span>}
      <p className="text-base font-medium text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
    </div>
  );
}
