import { render, screen } from '@testing-library/react';
import TaskCard from '@/components/tasks/TaskCard';
import { Task } from '@/types/task';
import { Worker } from '@/types/user';

const baseTask: Task = {
  id: 1,
  title: 'Water the plants',
  description: 'Irrigate all zones',
  status: 'todo',
  priority: 'medium',
  taskType: 'irrigation',
  createdByUserId: 1,
  assignedToUserId: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  pepperId: null,
  zoneId: null,
  zoneCode: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const workers: Worker[] = [
  { userId: 2, fullName: 'Alice Smith', email: 'alice@farm.com' },
];

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.getByText('Water the plants')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.getByText('Irrigate all zones')).toBeInTheDocument();
  });

  it('does not render description when absent', () => {
    render(<TaskCard task={{ ...baseTask, description: null }} workers={[]} />);
    expect(screen.queryByText('Irrigate all zones')).not.toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.getByText('todo')).toBeInTheDocument();
  });

  it('renders in_progress status with space', () => {
    render(<TaskCard task={{ ...baseTask, status: 'in_progress' }} workers={[]} />);
    expect(screen.getByText('in progress')).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('uses a bright card color for the task priority', () => {
    const { container } = render(<TaskCard task={{ ...baseTask, priority: 'critical' }} workers={[]} />);
    expect(container.firstChild).toHaveClass('!bg-red-400');
    expect(container.firstChild).toHaveClass('!border-0');
  });

  it('uses a bright priority badge color', () => {
    render(<TaskCard task={{ ...baseTask, priority: 'high' }} workers={[]} />);
    expect(screen.getByText('high')).toHaveClass('bg-orange-200');
  });

  it('renders task type', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.getByText('irrigation')).toBeInTheDocument();
  });

  it('renders assignee name when assigned', () => {
    render(<TaskCard task={{ ...baseTask, assignedToUserId: 2 }} workers={workers} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
  });

  it('does not render assignee when not assigned', () => {
    render(<TaskCard task={baseTask} workers={workers} />);
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });

  it('renders due date when present', () => {
    render(<TaskCard task={{ ...baseTask, dueDate: '2025-06-15T00:00:00Z' }} workers={[]} />);
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  it('does not render due date when absent', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
  });
});
