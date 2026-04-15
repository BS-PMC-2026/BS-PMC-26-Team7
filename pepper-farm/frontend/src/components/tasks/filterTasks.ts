import type { Task, TaskPriority } from '@/types/task';

export interface TaskFilters {
  priority: TaskPriority | '';
  taskType: string;
}

export const EMPTY_TASK_FILTERS: TaskFilters = {
  priority: '',
  taskType: '',
};

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((task) => {
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.taskType && task.taskType !== filters.taskType) return false;
    return true;
  });
}
