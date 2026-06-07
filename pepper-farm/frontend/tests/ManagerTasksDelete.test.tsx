import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManageTasksModalContent from '@/components/tasks/ManageTasksModalContent';
import { cancelTask, getCompletedTasks, getTasks } from '@/services/tasks';
import { getAllUsers } from '@/services/users';
import { getZones } from '@/services/zones';
import type { Task } from '@/types/task';

// Current manager is user id 1 — matches createdByUserId on the fixtures below,
// so Delete is offered (UI gate uses the JWT sub via getCurrentUserId).
jest.mock('@/lib/auth', () => ({
  getCurrentUserId: () => 1,
}));

jest.mock('@/services/tasks', () => ({
  createTask: jest.fn(),
  getTasks: jest.fn(),
  getCompletedTasks: jest.fn(),
  updateTask: jest.fn(),
  syncChecklistItems: jest.fn(),
  cancelTask: jest.fn(),
}));

jest.mock('@/services/users', () => ({
  getAllUsers: jest.fn(),
}));

jest.mock('@/services/zones', () => ({
  getZones: jest.fn(),
}));

jest.mock('@/services/plants', () => ({
  getAllPlants: jest.fn().mockResolvedValue([]),
  createPlant: jest.fn(),
}));

jest.mock('@/services/peppers', () => ({
  getAllPeppers: jest.fn().mockResolvedValue([]),
}));

const tasks: Task[] = [
  {
    id: 1,
    title: 'High irrigation task',
    description: null,
    status: 'todo',
    priority: 'high',
    taskType: 'irrigation',
    createdByUserId: 1,
    assignedToUserId: 2,
    dueDate: null,
    startedAt: null,
    completedAt: null,
    pepperId: null,
    zoneId: null,
    zoneCode: 'GH-01',
    anomalyId: null,
    alertInfo: null,
    checklistItems: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Medium inspection task',
    description: null,
    status: 'todo',
    priority: 'medium',
    taskType: 'inspection',
    createdByUserId: 1,
    assignedToUserId: 2,
    dueDate: null,
    startedAt: null,
    completedAt: null,
    pepperId: null,
    zoneId: null,
    zoneCode: 'GH-02',
    anomalyId: null,
    alertInfo: null,
    checklistItems: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const completedTask: Task = {
  ...tasks[0],
  id: 99,
  title: 'Completed task X',
  status: 'done',
  completedAt: '2024-02-01T00:00:00Z',
};

function renderModal(activeTab: 'active' | 'history' = 'active') {
  return render(
    <ManageTasksModalContent
      activeTab={activeTab}
      onTabChange={() => {}}
      alertPrefill={null}
      onAlertPrefillConsumed={() => {}}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('token', 'token');
  (getTasks as jest.Mock).mockResolvedValue(tasks);
  (getCompletedTasks as jest.Mock).mockResolvedValue([completedTask]);
  (getAllUsers as jest.Mock).mockResolvedValue([]);
  (getZones as jest.Mock).mockResolvedValue([]);
  (cancelTask as jest.Mock).mockResolvedValue({ ...tasks[0], status: 'cancelled' });
});

describe('manager task delete (US42)', () => {
  it('opens a confirmation dialog when Delete is clicked', async () => {
    renderModal('active');
    expect(await screen.findByText('High irrigation task')).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText('Delete task?')).toBeInTheDocument();
    // cancelTask must NOT be called just by opening the dialog
    expect(cancelTask).not.toHaveBeenCalled();
  });

  it('soft-deletes the task and removes it from the list on confirm', async () => {
    renderModal('active');
    expect(await screen.findByText('High irrigation task')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(screen.getByText('Delete task?')).toBeInTheDocument();

    // Card Delete buttons (2) + modal confirm Delete (1); the modal one is last.
    const allDeletes = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(allDeletes[allDeletes.length - 1]);

    await waitFor(() => expect(cancelTask).toHaveBeenCalledWith(1, 'token'));
    await waitFor(() =>
      expect(screen.queryByText('High irrigation task')).not.toBeInTheDocument(),
    );
    // The other task is untouched.
    expect(screen.getByText('Medium inspection task')).toBeInTheDocument();
  });

  it('leaves the task unchanged when the dialog is cancelled', async () => {
    renderModal('active');
    expect(await screen.findByText('High irrigation task')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(cancelTask).not.toHaveBeenCalled();
    expect(screen.getByText('High irrigation task')).toBeInTheDocument();
    expect(screen.queryByText('Delete task?')).not.toBeInTheDocument();
  });

  it('excludes done tasks from the Active tab (completed tasks live in History)', async () => {
    const doneTask: Task = { ...tasks[0], id: 7, title: 'Done active task', status: 'done' };
    (getTasks as jest.Mock).mockResolvedValue([...tasks, doneTask]);

    renderModal('active');
    expect(await screen.findByText('High irrigation task')).toBeInTheDocument();
    // The done task must not appear in the Active list.
    expect(screen.queryByText('Done active task')).not.toBeInTheDocument();
  });

  it('soft-deletes a completed task from the History tab on confirm', async () => {
    renderModal('history');
    expect(await screen.findByText('Completed task X')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete task?')).toBeInTheDocument();

    const allDeletes = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(allDeletes[allDeletes.length - 1]);

    await waitFor(() => expect(cancelTask).toHaveBeenCalledWith(99, 'token'));
    await waitFor(() =>
      expect(screen.queryByText('Completed task X')).not.toBeInTheDocument(),
    );
  });
});
