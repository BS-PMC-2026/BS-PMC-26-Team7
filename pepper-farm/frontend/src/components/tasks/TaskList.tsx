import { Task } from '@/types/task';
import { Worker } from '@/types/user';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  workers?: Worker[];
}

export default function TaskList({ tasks, workers = [] }: TaskListProps) {
  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} workers={workers} />
      ))}
    </div>
  );
}
