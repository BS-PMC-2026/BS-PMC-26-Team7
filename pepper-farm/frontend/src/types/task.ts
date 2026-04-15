export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface CreateTaskFormData {
  title: string;
  description: string;
  taskType: string;
  priority: TaskPriority;
  assignedToUserId: string;
  dueDate: string;
  zoneId: string; // numeric id as string, empty = none
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  taskType: string;
  createdByUserId: number;
  assignedToUserId: number | null;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  pepperId: number | null;
  zoneId: number | null;
  zoneCode: string | null;
  createdAt: string;
  updatedAt: string;
}
