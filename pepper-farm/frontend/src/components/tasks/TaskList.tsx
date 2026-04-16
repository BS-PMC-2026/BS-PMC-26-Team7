import { Task, TaskStatus } from '@/types/task';
import { Worker } from '@/types/user';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  workers?: Worker[];
  onEdit?: (task: Task) => void;
  onStatusChange?: (task: Task, newStatus: TaskStatus) => void;
}

export default function TaskList({ tasks, workers = [], onEdit, onStatusChange }: TaskListProps) {
  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          workers={workers}
          onEdit={onEdit}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
