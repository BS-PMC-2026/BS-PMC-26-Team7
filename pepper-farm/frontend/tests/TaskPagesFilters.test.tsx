import { fireEvent, render, screen } from '@testing-library/react';
import ManagerTasksPage from '@/app/manager/tasks/page';
import WorkerPage from '@/app/worker/page';
import { getMyTasks, getTasks } from '@/services/tasks';
import { getAllUsers } from '@/services/users';
import { getZones } from '@/services/zones';
import type { Task } from '@/types/task';

const mockRouter = { replace: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/components/map/FarmMap', () => ({
  __esModule: true,
  default: () => <div>Farm map</div>,
}));

jest.mock('@/services/tasks', () => ({
  createTask: jest.fn(),
  getMyTasks: jest.fn(),
  getTasks: jest.fn(),
  updateTask: jest.fn(),
}));

jest.mock('@/services/users', () => ({
  getAllUsers: jest.fn(),
}));

jest.mock('@/services/zones', () => ({
  getZones: jest.fn(),
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
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.replace.mockClear();
  localStorage.setItem('token', 'token');
  (getTasks as jest.Mock).mockResolvedValue(tasks);
  (getMyTasks as jest.Mock).mockResolvedValue(tasks);
  (getAllUsers as jest.Mock).mockResolvedValue([]);
  (getZones as jest.Mock).mockResolvedValue([]);
});

describe('task page filters', () => {
  it('filters manager tasks by importance', async () => {
    render(<ManagerTasksPage />);

    expect(await screen.findByText('High irrigation task')).toBeInTheDocument();
    expect(screen.getByText('Medium inspection task')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Importance'), { target: { value: 'high' } });

    expect(screen.getByText('High irrigation task')).toBeInTheDocument();
    expect(screen.queryByText('Medium inspection task')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument();
  });

  it('filters worker tasks by type', async () => {
    render(<WorkerPage />);

    expect(await screen.findByText('High irrigation task')).toBeInTheDocument();
    expect(screen.getByText('Medium inspection task')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'inspection' } });

    expect(screen.queryByText('High irrigation task')).not.toBeInTheDocument();
    expect(screen.getByText('Medium inspection task')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument();
  });
});
