import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TasksReportPage from '@/app/manager/reports/open-tasks/page';
import * as tasksService from '@/services/tasks';
import * as usersService from '@/services/users';

jest.mock('@/services/tasks');
jest.mock('@/services/users');

const mockWorkers = [
  { userId: 3, fullName: 'Field Worker', email: 'worker@farm.com',  roleName: 'Worker', isActive: true },
  { userId: 7, fullName: 'Field Worker', email: 'worker2@farm.com', roleName: 'Worker', isActive: true },
];

const mockTasks = [
  { id: 1, title: 'Task A', taskType: 'irrigation', priority: 'medium', status: 'todo',        assignedToUserId: 3, dueDate: null, zoneCode: 'GH-01' },
  { id: 2, title: 'Task B', taskType: 'inspection', priority: 'high',   status: 'in_progress', assignedToUserId: 3, dueDate: null, zoneCode: null },
];

describe('TasksReportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAllUsers as jest.Mock).mockResolvedValue(mockWorkers);
  });

  it('renders page title', () => {
    render(<TasksReportPage />);
    expect(screen.getByText(/Open Tasks Report/)).toBeInTheDocument();
  });

  it('renders worker dropdown', async () => {
    render(<TasksReportPage />);
    await waitFor(() => {
      expect(screen.getByText(/Choose a worker/)).toBeInTheDocument();
    });
  });

  it('renders workers in dropdown', async () => {
    render(<TasksReportPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Field Worker/).length).toBeGreaterThan(0);
    });
  });

  it('renders Show Report button', () => {
    render(<TasksReportPage />);
    expect(screen.getByText('Show Report')).toBeInTheDocument();
  });

  it('shows tasks after clicking Show Report', async () => {
    (tasksService.getTasksReportByWorker as jest.Mock).mockResolvedValueOnce(mockTasks);

    render(<TasksReportPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Field Worker/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Show Report'));

    await waitFor(() => {
      expect(screen.getByText('Task A')).toBeInTheDocument();
      expect(screen.getByText('Task B')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tasks', async () => {
    (tasksService.getTasksReportByWorker as jest.Mock).mockResolvedValueOnce([]);

    render(<TasksReportPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Field Worker/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });

    await waitFor(() => {
      expect(screen.getByText('Show Report')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('Show Report'));

    await waitFor(() => {
      expect(screen.getByText(/No open tasks for this worker/)).toBeInTheDocument();
    });
  });

  it('shows error when no worker selected', async () => {
    render(<TasksReportPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Field Worker/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Show Report')).toBeDisabled();
  });

  it('shows priority badge', async () => {
    (tasksService.getTasksReportByWorker as jest.Mock).mockResolvedValueOnce(mockTasks);

    render(<TasksReportPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Field Worker/).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    fireEvent.click(screen.getByText('Show Report'));

    await waitFor(() => {
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
    });
  });
});