'use client';

import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import type { TaskPriority } from '@/types/task';
import { useLanguage } from '@/context/LanguageContext';
import { translateEnum } from '@/i18n/dictionaries';

interface TaskFiltersProps {
  priority: TaskPriority | '';
  taskType: string;
  totalCount: number;
  resultCount: number;
  onPriorityChange: (priority: TaskPriority | '') => void;
  onTaskTypeChange: (taskType: string) => void;
  onClear: () => void;
  className?: string;
}

export default function TaskFilters({
  priority,
  taskType,
  totalCount,
  resultCount,
  onPriorityChange,
  onTaskTypeChange,
  onClear,
  className = '',
}: TaskFiltersProps) {
  const { t } = useLanguage();
  const tk = t.tasks;
  const hasActiveFilters = Boolean(priority || taskType);

  const priorityOptions: Array<{ value: TaskPriority | ''; label: string }> = [
    { value: '', label: tk.filterAllImportance },
    { value: 'low',      label: translateEnum('low',      t.enums.priority) },
    { value: 'medium',   label: translateEnum('medium',   t.enums.priority) },
    { value: 'high',     label: translateEnum('high',     t.enums.priority) },
    { value: 'critical', label: translateEnum('critical', t.enums.priority) },
  ];

  const taskTypeOptions = [
    { value: '',             label: tk.filterAllTypes },
    { value: 'irrigation',  label: translateEnum('irrigation',  t.enums.taskType) },
    { value: 'harvesting',  label: translateEnum('harvesting',  t.enums.taskType) },
    { value: 'planting',    label: translateEnum('planting',    t.enums.taskType) },
    { value: 'fertilizing', label: translateEnum('fertilizing', t.enums.taskType) },
    { value: 'inspection',  label: translateEnum('inspection',  t.enums.taskType) },
    { value: 'other',       label: translateEnum('other',       t.enums.taskType) },
  ];

  const showingText = tk.showingOf
    .replace('{result}', String(resultCount))
    .replace('{total}',  String(totalCount));

  return (
    <div className={`flex flex-col gap-3 md:flex-row md:items-end md:justify-between ${className}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex-1">
        <Select
          id="task-priority-filter"
          label={tk.filterImportance}
          options={priorityOptions}
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value as TaskPriority | '')}
        />

        <Select
          id="task-type-filter"
          label={tk.filterType}
          options={taskTypeOptions}
          value={taskType}
          onChange={(e) => onTaskTypeChange(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <p className="text-xs text-gray-500" dir="ltr">
          {showingText}
        </p>
        {hasActiveFilters && (
          <Button type="button" variant="secondary" onClick={onClear}>
            {tk.clear}
          </Button>
        )}
      </div>
    </div>
  );
}
