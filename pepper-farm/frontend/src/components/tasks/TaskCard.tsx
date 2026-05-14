import { AlertInfo, Task, TaskStatus } from '@/types/task';
import { Worker } from '@/types/user';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { PRIORITY_BADGE_STYLES, PRIORITY_CARD_STYLES } from './taskOptions';

const SEVERITY_STYLES: Record<string, string> = {
  High: 'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
};

function AlertInfoPanel({ info, anomalyId }: { info: AlertInfo; anomalyId: number }) {
  const severityStyle = SEVERITY_STYLES[info.severity] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const range =
    info.minAllowed != null && info.maxAllowed != null
      ? `${info.minAllowed}–${info.maxAllowed}`
      : info.minAllowed != null
      ? `≥${info.minAllowed}`
      : info.maxAllowed != null
      ? `≤${info.maxAllowed}`
      : null;

  return (
    <div className={`mt-1 rounded-lg border px-3 py-2 text-xs ${severityStyle}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold uppercase tracking-wide">Alert #{anomalyId}</span>
        <Badge className={severityStyle}>{info.severity}</Badge>
        {info.isResolved && (
          <Badge className="bg-green-100 text-green-700">Resolved</Badge>
        )}
      </div>
      <p className="font-medium">
        {info.metricName}: <span className="font-bold">{info.actualValue}</span>
        {range && <span className="font-normal text-current opacity-70"> (allowed: {range})</span>}
      </p>
      <p className="mt-0.5 opacity-80 leading-snug">{info.message}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  todo: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: 'in_progress',
  in_progress: 'done',
};

const NEXT_STATUS_LABEL: Partial<Record<TaskStatus, string>> = {
  todo: 'Start',
  in_progress: 'Complete',
};

interface TaskCardProps {
  task: Task;
  workers: Worker[];
  onEdit?: (task: Task) => void;
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void;
}

export default function TaskCard({ task, workers, onEdit, onStatusChange }: TaskCardProps) {
  const assignee = workers.find((w) => w.userId === task.assignedToUserId);
  const dueDateLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString()
    : null;

  const nextStatus = NEXT_STATUS[task.status];
  const priorityCardStyle = PRIORITY_CARD_STYLES[task.priority] ?? '!bg-white';
  const priorityBadgeStyle = PRIORITY_BADGE_STYLES[task.priority] ?? 'bg-gray-100 text-gray-600';

  return (
    <Card className={`p-4 flex flex-col gap-2 !border-0 shadow-sm ${priorityCardStyle}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-950 leading-snug">{task.title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className={STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600'}>
            {task.status.replace('_', ' ')}
          </Badge>
          <Badge className={priorityBadgeStyle}>
            {task.priority}
          </Badge>
          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="ml-1 px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-sm text-gray-900 leading-relaxed">{task.description}</p>
      )}

      {task.alertInfo && task.anomalyId != null && (
        <AlertInfoPanel info={task.alertInfo} anomalyId={task.anomalyId} />
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-800 mt-1">
        <span>Type: <span className="text-gray-950 font-semibold">{task.taskType}</span></span>
        {task.assignedToUserId === null ? (
          <span className="text-gray-950 font-semibold">Unassigned</span>
        ) : assignee ? (
          <span>Assigned to: <span className="text-gray-950 font-semibold">{assignee.fullName}</span></span>
        ) : null}
        {dueDateLabel && (
          <span>Due: <span className="text-gray-950 font-semibold">{dueDateLabel}</span></span>
        )}
        {task.zoneCode && (
          <span>Zone: <span className="text-gray-950 font-semibold">{task.zoneCode}</span></span>
        )}
        {onStatusChange && nextStatus && (
          <button
            onClick={() => onStatusChange(task, nextStatus)}
            className="ml-auto px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors"
          >
            {NEXT_STATUS_LABEL[task.status]}
          </button>
        )}
      </div>
    </Card>
  );
}
