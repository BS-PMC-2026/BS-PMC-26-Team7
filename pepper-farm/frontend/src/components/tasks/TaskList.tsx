import { ChecklistItem, Task, TaskStatus } from '@/types/task';
import { Worker } from '@/types/user';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  workers?: Worker[];
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  /** Current manager's id; Delete is only offered on tasks they created. */
  currentUserId?: number | null;
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void;
  onToggleChecklistItem?: (task: Task, item: ChecklistItem, nextCompleted: boolean) => void;
}

export default function TaskList({
  tasks,
  workers = [],
  onEdit,
  onDelete,
  currentUserId,
  onStatusChange,
  onToggleChecklistItem,
}: TaskListProps) {
  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          workers={workers}
          onEdit={onEdit}
          onDelete={onDelete}
          canDelete={currentUserId != null && task.createdByUserId === currentUserId}
          onStatusChange={onStatusChange}
          onToggleChecklistItem={onToggleChecklistItem}
        />
      ))}
    </div>
  );
}
