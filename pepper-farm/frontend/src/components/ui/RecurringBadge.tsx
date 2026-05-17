interface RecurringBadgeProps {
  isRecurring: boolean;
  occurrenceCount: number;
  windowHours?: number;
}

export default function RecurringBadge({
  isRecurring,
  occurrenceCount,
  windowHours = 168,
}: RecurringBadgeProps) {
  if (!isRecurring) return null;

  const days = Math.round(windowHours / 24);
  const tooltip = `Occurred ${occurrenceCount} times in the last ${days} days`;

  return (
    <span
      title={tooltip}
      className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200"
    >
      ×{occurrenceCount}
    </span>
  );
}
