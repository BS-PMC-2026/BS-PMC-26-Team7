import { SelectHTMLAttributes } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
}

export default function Select({ label, options, error, id, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-foreground)]">
        {label}
      </label>
      <select
        id={id}
        className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white ${
          error ? 'border-red-400' : 'border-[var(--color-border)]'
        }`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
