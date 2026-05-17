'use client';

import { AlertInfo, Task, TaskStatus } from '@/types/task';
import { Worker } from '@/types/user';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { PRIORITY_BADGE_STYLES, PRIORITY_CARD_STYLES } from './taskOptions';
import { useLanguage } from '@/context/LanguageContext';
import { translateEnum } from '@/i18n/dictionaries';

const SEVERITY_STYLES: Record<string, string> = {
  High: 'bg-red-100 text-red-700 border-red-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
};

function AlertInfoPanel({ info, anomalyId }: { info: AlertInfo; anomalyId: number }) {
  const { t } = useLanguage();
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
        <span className="font-semibold uppercase tracking-wide" dir="ltr">Alert #{anomalyId}</span>
        <Badge className={severityStyle}>{translateEnum(info.severity, t.enums.severity)}</Badge>
        {info.isResolved && (
          <Badge className="bg-green-100 text-green-700">{t.anomalies.resolved}</Badge>
        )}
      </div>
      <p className="font-medium">
        {translateEnum(info.metricName, t.enums.metric)}: <span className="font-bold" dir="ltr">{info.actualValue}</span>
        {range && <span className="font-normal text-current opacity-70"> ({t.tasks.allowedRange}: <span dir="ltr">{range}</span>)</span>}
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

interface TaskCardProps {
  task: Task;
  workers: Worker[];
  onEdit?: (task: Task) => void;
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void;
}

export default function TaskCard({ task, workers, onEdit, onStatusChange }: TaskCardProps) {
  const { t } = useLanguage();
  const tk = t.tasks;
  const assignee = workers.find((w) => w.userId === task.assignedToUserId);
  const dueDateLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString()
    : null;

  const nextStatus = NEXT_STATUS[task.status];
  const priorityCardStyle = PRIORITY_CARD_STYLES[task.priority] ?? '!bg-white';
  const priorityBadgeStyle = PRIORITY_BADGE_STYLES[task.priority] ?? 'bg-gray-100 text-gray-600';

  const nextStatusLabel: Partial<Record<TaskStatus, string>> = {
    todo: tk.startButton,
    in_progress: tk.completeButton,
  };

  return (
    <Card className={`p-4 flex flex-col gap-2 !border-0 shadow-sm ${priorityCardStyle}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-950 leading-snug">{task.title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className={STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600'}>
            {translateEnum(task.status, t.enums.taskStatus)}
          </Badge>
          <Badge className={priorityBadgeStyle}>
            {translateEnum(task.priority, t.enums.priority)}
          </Badge>
          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="ml-1 px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {tk.editButton}
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
        <span>{tk.typeLabel}: <span className="text-gray-950 font-semibold">{translateEnum(task.taskType, t.enums.taskType)}</span></span>
        {task.assignedToUserId === null ? (
          <span className="text-gray-950 font-semibold">{tk.formUnassigned}</span>
        ) : assignee ? (
          <span>{tk.assignedTo}: <span className="text-gray-950 font-semibold">{assignee.fullName}</span></span>
        ) : null}
        {dueDateLabel && (
          <span>{tk.due}: <span className="text-gray-950 font-semibold" dir="ltr">{dueDateLabel}</span></span>
        )}
        {task.zoneCode && (
          <span>{tk.zone}: <span className="text-gray-950 font-semibold" dir="ltr">{task.zoneCode}</span></span>
        )}
        {onStatusChange && nextStatus && (
          <button
            onClick={() => onStatusChange(task, nextStatus)}
            className="ml-auto px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors"
          >
            {nextStatusLabel[task.status]}
          </button>
        )}
      </div>
    </Card>
  );
}
