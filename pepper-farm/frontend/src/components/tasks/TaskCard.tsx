'use client';

import { AlertInfo, ChecklistItem, Task, TaskStatus } from '@/types/task';
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

function ChecklistPanel({
  task,
  onToggleChecklistItem,
}: {
  task: Task;
  onToggleChecklistItem?: (task: Task, item: ChecklistItem, nextCompleted: boolean) => void;
}) {
  const { t } = useLanguage();
  const tk = t.tasks;
  const items = task.checklistItems;
  const total = items.length;
  const done = items.filter((i) => i.isCompleted).length;
  const percent = total === 0 ? 0 : (done / total) * 100;
  const caption = tk.progressOf
    .replace('{done}', String(done))
    .replace('{total}', String(total));

  return (
    <div className="mt-1 flex flex-col gap-2">
      <div>
        <div className="flex items-center justify-between text-xs text-gray-700 mb-1">
          <span className="font-medium">{tk.progress}</span>
          <span dir="ltr">{caption}</span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-gray-200 overflow-hidden"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            data-testid="checklist-progress-bar"
            className="h-full bg-green-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.itemId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.isCompleted}
              disabled={!onToggleChecklistItem}
              onChange={(e) =>
                onToggleChecklistItem?.(task, item, e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span
              className={
                item.isCompleted
                  ? 'text-gray-500 line-through'
                  : 'text-gray-900'
              }
            >
              {item.title}
            </span>
          </li>
        ))}
      </ul>
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
  onToggleChecklistItem?: (task: Task, item: ChecklistItem, nextCompleted: boolean) => void;
}

export default function TaskCard({
  task,
  workers,
  onEdit,
  onStatusChange,
  onToggleChecklistItem,
}: TaskCardProps) {
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

  // Block the Complete transition while any checklist item is still open.
  // Tasks without checklist items keep the existing behavior.
  const hasChecklistItems = !!task.checklistItems && task.checklistItems.length > 0;
  const allChecklistDone = hasChecklistItems && task.checklistItems.every((i) => i.isCompleted);
  const completeBlockedByChecklist =
    hasChecklistItems && !allChecklistDone && nextStatus === 'done';

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

      {task.checklistItems && task.checklistItems.length > 0 && (
        <ChecklistPanel
          task={task}
          onToggleChecklistItem={onToggleChecklistItem}
        />
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
            disabled={completeBlockedByChecklist}
            title={completeBlockedByChecklist ? tk.completeBlockedByChecklist : undefined}
            className="ml-auto px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-100"
          >
            {nextStatusLabel[task.status]}
          </button>
        )}
      </div>
    </Card>
  );
}
