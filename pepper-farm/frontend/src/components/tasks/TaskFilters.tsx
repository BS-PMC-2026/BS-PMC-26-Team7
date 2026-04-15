import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import type { TaskPriority } from '@/types/task';
import { PRIORITY_OPTIONS, TASK_TYPE_OPTIONS } from './taskOptions';

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
  const hasActiveFilters = Boolean(priority || taskType);

  return (
    <div className={`flex flex-col gap-3 md:flex-row md:items-end md:justify-between ${className}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex-1">
        <Select
          id="task-priority-filter"
          label="Importance"
          options={[
            { value: '', label: 'All importance' },
            ...PRIORITY_OPTIONS,
          ]}
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value as TaskPriority | '')}
        />

        <Select
          id="task-type-filter"
          label="Type"
          options={[
            { value: '', label: 'All types' },
            ...TASK_TYPE_OPTIONS,
          ]}
          value={taskType}
          onChange={(e) => onTaskTypeChange(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <p className="text-xs text-gray-500">
          Showing {resultCount} of {totalCount}
        </p>
        {hasActiveFilters && (
          <Button type="button" variant="secondary" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
