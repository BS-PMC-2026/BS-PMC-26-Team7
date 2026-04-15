import { filterTasks } from '@/components/tasks/filterTasks';
import type { Task } from '@/types/task';

const tasks: Task[] = [
  {
    id: 1,
    title: 'Water greenhouse',
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
    title: 'Inspect plants',
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
  {
    id: 3,
    title: 'Check irrigation',
    description: null,
    status: 'done',
    priority: 'high',
    taskType: 'inspection',
    createdByUserId: 1,
    assignedToUserId: 2,
    dueDate: null,
    startedAt: null,
    completedAt: null,
    pepperId: null,
    zoneId: null,
    zoneCode: 'GH-03',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

describe('filterTasks', () => {
  it('returns every task when no filters are active', () => {
    expect(filterTasks(tasks, { priority: '', taskType: '' })).toHaveLength(3);
  });

  it('filters tasks by importance', () => {
    expect(filterTasks(tasks, { priority: 'high', taskType: '' }).map((task) => task.id)).toEqual([1, 3]);
  });

  it('filters tasks by type', () => {
    expect(filterTasks(tasks, { priority: '', taskType: 'inspection' }).map((task) => task.id)).toEqual([2, 3]);
  });

  it('filters tasks by importance and type together', () => {
    expect(filterTasks(tasks, { priority: 'high', taskType: 'inspection' }).map((task) => task.id)).toEqual([3]);
  });
});
