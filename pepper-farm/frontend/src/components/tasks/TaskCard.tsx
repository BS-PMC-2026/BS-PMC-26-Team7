import { Task } from '@/types/task';
import { Worker } from '@/types/user';

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_STYLES: Record<string, string> = {
  todo: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

interface TaskCardProps {
  task: Task;
  workers: Worker[];
}

export default function TaskCard({ task, workers }: TaskCardProps) {
  const assignee = workers.find((w) => w.userId === task.assignedToUserId);
  const dueDateLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString()
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-medium text-gray-800 leading-snug">{task.title}</h3>
        <div className="flex gap-1 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {task.status.replace('_', ' ')}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority] ?? 'bg-gray-100 text-gray-600'}`}>
            {task.priority}
          </span>
        </div>
      </div>

      {task.description && (
        <p className="text-sm text-gray-500 leading-relaxed">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-1">
        <span>Type: <span className="text-gray-600 font-medium">{task.taskType}</span></span>
        {assignee && (
          <span>Assigned to: <span className="text-gray-600 font-medium">{assignee.fullName}</span></span>
        )}
        {dueDateLabel && (
          <span>Due: <span className="text-gray-600 font-medium">{dueDateLabel}</span></span>
        )}
      </div>
    </div>
  );
}
