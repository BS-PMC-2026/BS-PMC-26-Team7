import type { TaskPriority } from '@/types/task';

export const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const TASK_TYPE_OPTIONS = [
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'harvesting', label: 'Harvesting' },
  { value: 'planting', label: 'Planting' },
  { value: 'fertilizing', label: 'Fertilizing' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

export const PRIORITY_CARD_STYLES: Record<TaskPriority, string> = {
  low: '!bg-green-100',
  medium: '!bg-yellow-100',
  high: '!bg-orange-100',
  critical: '!bg-red-400',
};

export const PRIORITY_BADGE_STYLES: Record<TaskPriority, string> = {
  low: 'bg-green-200 text-green-950',
  medium: 'bg-yellow-200 text-yellow-950',
  high: 'bg-orange-200 text-orange-950',
  critical: 'bg-red-600 text-white',
};

export const PRIORITY_POPUP_STYLES: Record<TaskPriority, string> = {
  low: 'bg-green-100 hover:bg-green-200 text-green-950',
  medium: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-950',
  high: 'bg-orange-100 hover:bg-orange-200 text-orange-950',
  critical: 'bg-red-400 hover:bg-red-500 text-white',
};
