import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from '@/components/tasks/TaskCard';
import { AlertInfo, ChecklistItem, Task } from '@/types/task';
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
  anomalyId: null,
  alertInfo: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  checklistItems: [],
};

function makeItems(states: boolean[]): ChecklistItem[] {
  return states.map((isCompleted, index) => ({
    itemId: index + 1,
    title: `Step ${index + 1}`,
    isCompleted,
    position: index,
  }));
}

const sampleAlertInfo: AlertInfo = {
  severity: 'High',
  metricName: 'Temperature',
  actualValue: 45.0,
  minAllowed: 10.0,
  maxAllowed: 35.0,
  message: 'Temperature exceeds safe threshold.',
  isResolved: false,
  createdAtUtc: '2026-05-01T10:00:00',
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
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('renders in_progress status with space', () => {
    render(<TaskCard task={{ ...baseTask, status: 'in_progress' }} workers={[]} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('uses a bright card color for the task priority', () => {
    const { container } = render(<TaskCard task={{ ...baseTask, priority: 'critical' }} workers={[]} />);
    expect(container.firstChild).toHaveClass('!bg-red-400');
    expect(container.firstChild).toHaveClass('!border-0');
  });

  it('uses a bright priority badge color', () => {
    render(<TaskCard task={{ ...baseTask, priority: 'high' }} workers={[]} />);
    expect(screen.getByText('High')).toHaveClass('bg-orange-200');
  });

  it('renders task type', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.getByText('Irrigation')).toBeInTheDocument();
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

  // ---- Alert info panel (US25) ----

  it('does not render alert panel when alertInfo is null', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.queryByText(/Alert #/)).not.toBeInTheDocument();
  });

  it('renders alert panel with anomaly ID when alertInfo is present', () => {
    const task = { ...baseTask, anomalyId: 7, alertInfo: sampleAlertInfo };
    render(<TaskCard task={task} workers={[]} />);
    expect(screen.getByText(/Alert #7/)).toBeInTheDocument();
  });

  it('renders alert severity badge', () => {
    const task = { ...baseTask, anomalyId: 7, alertInfo: sampleAlertInfo };
    render(<TaskCard task={task} workers={[]} />);
    // Two "High" texts: the severity badge inside panel
    const badges = screen.getAllByText('High');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders alert metric name and actual value', () => {
    const task = { ...baseTask, anomalyId: 7, alertInfo: sampleAlertInfo };
    render(<TaskCard task={task} workers={[]} />);
    expect(screen.getAllByText(/Temperature/).length).toBeGreaterThan(0);
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('renders alert message', () => {
    const task = { ...baseTask, anomalyId: 7, alertInfo: sampleAlertInfo };
    render(<TaskCard task={task} workers={[]} />);
    expect(screen.getByText('Temperature exceeds safe threshold.')).toBeInTheDocument();
  });

  it('renders Resolved badge when alert is resolved', () => {
    const resolvedInfo: AlertInfo = { ...sampleAlertInfo, isResolved: true };
    const task = { ...baseTask, anomalyId: 7, alertInfo: resolvedInfo };
    render(<TaskCard task={task} workers={[]} />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('does not render Resolved badge when alert is not resolved', () => {
    const task = { ...baseTask, anomalyId: 7, alertInfo: sampleAlertInfo };
    render(<TaskCard task={task} workers={[]} />);
    expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
  });

  it('calls onStatusChange with in_progress when Start is clicked', () => {
    const onStatusChange = jest.fn();
    render(<TaskCard task={baseTask} workers={[]} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByText('Start'));
    expect(onStatusChange).toHaveBeenCalledWith(baseTask, 'in_progress');
  });

  it('calls onStatusChange with done when Complete is clicked', () => {
    const onStatusChange = jest.fn();
    const task = { ...baseTask, status: 'in_progress' as const };
    render(<TaskCard task={task} workers={[]} onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByText('Complete'));
    expect(onStatusChange).toHaveBeenCalledWith(task, 'done');
  });

  // ---- Checklist + progress bar (US39) ----

  it('does not render checklist or progress bar when checklistItems is empty', () => {
    render(<TaskCard task={baseTask} workers={[]} />);
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/completed/)).not.toBeInTheDocument();
  });

  it('renders checklist item titles when items exist', () => {
    const task = { ...baseTask, checklistItems: makeItems([false, false, false]) };
    render(<TaskCard task={task} workers={[]} />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('progress bar width reflects completed ratio (2/4 = 50%)', () => {
    const task = {
      ...baseTask,
      checklistItems: makeItems([true, true, false, false]),
    };
    render(<TaskCard task={task} workers={[]} />);
    expect(screen.getByText('2 / 4 completed')).toBeInTheDocument();
    const bar = screen.getByTestId('checklist-progress-bar');
    expect(bar).toHaveStyle({ width: '50%' });
  });

  it('calls onToggleChecklistItem with the new completed state when a checkbox is clicked', () => {
    const onToggleChecklistItem = jest.fn();
    const task = { ...baseTask, checklistItems: makeItems([false]) };
    render(
      <TaskCard
        task={task}
        workers={[]}
        onToggleChecklistItem={onToggleChecklistItem}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onToggleChecklistItem).toHaveBeenCalledWith(
      task,
      task.checklistItems[0],
      true,
    );
  });

  // ---- Complete-button gating by checklist completion (US39) ----

  it('disables the Complete button when not all checklist items are completed', () => {
    const onStatusChange = jest.fn();
    const task = {
      ...baseTask,
      status: 'in_progress' as const,
      checklistItems: makeItems([true, true, false, false]),
    };
    render(
      <TaskCard task={task} workers={[]} onStatusChange={onStatusChange} />,
    );
    const completeButton = screen.getByText('Complete') as HTMLButtonElement;
    expect(completeButton).toBeDisabled();
    expect(completeButton).toHaveAttribute(
      'title',
      'Complete all checklist items first',
    );
    fireEvent.click(completeButton);
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('enables the Complete button when all checklist items are completed', () => {
    const onStatusChange = jest.fn();
    const task = {
      ...baseTask,
      status: 'in_progress' as const,
      checklistItems: makeItems([true, true, true, true]),
    };
    render(
      <TaskCard task={task} workers={[]} onStatusChange={onStatusChange} />,
    );
    const completeButton = screen.getByText('Complete') as HTMLButtonElement;
    expect(completeButton).not.toBeDisabled();
    fireEvent.click(completeButton);
    expect(onStatusChange).toHaveBeenCalledWith(task, 'done');
  });

  it('keeps the Complete button enabled when the task has no checklist items', () => {
    const onStatusChange = jest.fn();
    const task = { ...baseTask, status: 'in_progress' as const };
    render(
      <TaskCard task={task} workers={[]} onStatusChange={onStatusChange} />,
    );
    const completeButton = screen.getByText('Complete') as HTMLButtonElement;
    expect(completeButton).not.toBeDisabled();
    fireEvent.click(completeButton);
    expect(onStatusChange).toHaveBeenCalledWith(task, 'done');
  });

  it('does not gate the Start button on checklist completion', () => {
    const onStatusChange = jest.fn();
    const task = {
      ...baseTask,
      status: 'todo' as const,
      checklistItems: makeItems([false, false]),
    };
    render(
      <TaskCard task={task} workers={[]} onStatusChange={onStatusChange} />,
    );
    const startButton = screen.getByText('Start') as HTMLButtonElement;
    expect(startButton).not.toBeDisabled();
    fireEvent.click(startButton);
    expect(onStatusChange).toHaveBeenCalledWith(task, 'in_progress');
  });

  // ---- Delete action (US42) ----

  it('does not render a Delete button when onDelete is not provided', () => {
    render(<TaskCard task={baseTask} workers={[]} onEdit={jest.fn()} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('renders a Delete button when onDelete is provided (manager view)', () => {
    render(<TaskCard task={baseTask} workers={[]} onDelete={jest.fn()} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onDelete with the task when Delete is clicked', () => {
    const onDelete = jest.fn();
    render(<TaskCard task={baseTask} workers={[]} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(baseTask);
  });

  it('renders a Delete button for done tasks (US42 updated rule)', () => {
    const task = { ...baseTask, status: 'done' as const };
    render(<TaskCard task={task} workers={[]} onDelete={jest.fn()} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides Delete when canDelete is false (task not created by current manager)', () => {
    render(<TaskCard task={baseTask} workers={[]} onDelete={jest.fn()} canDelete={false} />);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});
