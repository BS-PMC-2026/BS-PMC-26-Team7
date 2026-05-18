export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface AlertInfo {
  severity: string;
  metricName: string;
  actualValue: number;
  minAllowed: number | null;
  maxAllowed: number | null;
  message: string;
  isResolved: boolean;
  createdAtUtc: string;
}

export interface ChecklistItem {
  itemId: number;
  title: string;
  isCompleted: boolean;
  position: number;
}

// Used inside TaskForm: existing items carry itemId + isCompleted; new items don't.
export interface ChecklistFormItem {
  itemId?: number;
  title: string;
  isCompleted: boolean;
}

export interface CreateTaskFormData {
  title: string;
  description: string;
  taskType: string;
  priority: TaskPriority;
  assignedToUserId: string;
  dueDate: string;
  zoneCode: string; // section id like 'GH-01', empty = none
  checklistItems: ChecklistFormItem[];
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
  anomalyId: number | null;
  alertInfo: AlertInfo | null;
  createdAt: string;
  updatedAt: string;
  checklistItems: ChecklistItem[];
}
