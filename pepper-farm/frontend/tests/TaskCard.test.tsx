import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from '@/components/tasks/TaskCard';
import { AlertInfo, Task } from '@/types/task';
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
};

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
});
