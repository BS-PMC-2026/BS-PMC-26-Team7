'use client';

import { ChecklistItem } from '@/types/task';
import { useLanguage } from '@/context/LanguageContext';

interface TaskProgressBarProps {
  checklistItems: ChecklistItem[];
}

export default function TaskProgressBar({ checklistItems }: TaskProgressBarProps) {
  const { t } = useLanguage();
  const tk = t.tasks;
  const total = checklistItems.length;
  const done = checklistItems.filter((i) => i.isCompleted).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const caption = tk.progressOf
    .replace('{done}', String(done))
    .replace('{total}', String(total));

  if (total === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
        <span>{tk.progress}</span>
        <span dir="ltr">{caption}</span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          data-testid="task-progress-bar"
          className="h-full bg-green-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
