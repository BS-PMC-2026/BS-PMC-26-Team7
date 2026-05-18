import {
  addChecklistItem,
  createTask,
  updateChecklistItem,
} from '@/services/tasks';
import type { CreateTaskFormData } from '@/types/task';

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(() => 'fake-token-123'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  });
});

const baseFormData: CreateTaskFormData = {
  title: 'Water zone A',
  description: 'Irrigation needed',
  taskType: 'irrigation',
  priority: 'medium',
  assignedToUserId: '',
  dueDate: '',
  zoneCode: 'GH-01',
  checklistItems: [],
};

const mockTask = {
  id: 1,
  title: 'Water zone A',
  description: 'Irrigation needed',
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
  zoneCode: 'GH-01',
  anomalyId: null,
  alertInfo: null,
  createdAt: '2026-05-12T00:00:00',
  updatedAt: '2026-05-12T00:00:00',
  checklistItems: [],
};

// ------------------------------------------------------------------ //
// createTask without anomalyId
// ------------------------------------------------------------------ //

test('createTask sends POST to /api/tasks', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask(baseFormData);

  const [url, options] = (fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('/api/tasks');
  expect(options.method).toBe('POST');
});

test('createTask sends Authorization header', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask(baseFormData);

  const options = (fetch as jest.Mock).mock.calls[0][1];
  expect(options.headers.Authorization).toContain('Bearer');
});

test('createTask sends correct form fields in body', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask(baseFormData);

  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.title).toBe('Water zone A');
  expect(body.taskType).toBe('irrigation');
  expect(body.zoneCode).toBe('GH-01');
});

test('createTask does NOT include anomalyId in body when not provided', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask(baseFormData);

  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(body).not.toHaveProperty('anomalyId');
});

// ------------------------------------------------------------------ //
// createTask with anomalyId
// ------------------------------------------------------------------ //

test('createTask includes anomalyId in body when provided', async () => {
  const linkedTask = { ...mockTask, anomalyId: 5 };
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => linkedTask,
  });

  await createTask(baseFormData, 5);

  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.anomalyId).toBe(5);
});

test('createTask returns task with anomalyId from server', async () => {
  const linkedTask = { ...mockTask, anomalyId: 5 };
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => linkedTask,
  });

  const result = await createTask(baseFormData, 5);
  expect(result.anomalyId).toBe(5);
});

test('createTask throws on API error', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Alert #999 not found.' }),
  });

  await expect(createTask(baseFormData, 999)).rejects.toThrow('Alert #999 not found.');
});

test('createTask trims whitespace from title', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask({ ...baseFormData, title: '  Water zone A  ' });

  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.title).toBe('Water zone A');
});

test('createTask converts empty assignedToUserId to null', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask({ ...baseFormData, assignedToUserId: '' });

  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.assignedToUserId).toBeNull();
});

// ------------------------------------------------------------------ //
// Checklist items (US39)
// ------------------------------------------------------------------ //

test('createTask sends an empty checklistItems array by default', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask(baseFormData);

  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.checklistItems).toEqual([]);
});

test('createTask forwards checklist item titles, trimmed, dropping empties', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask({
    ...baseFormData,
    checklistItems: [
      { title: '  Check humidity  ' },
      { title: '' },
      { title: 'Log results' },
    ],
  });

  const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(body.checklistItems).toEqual([
    { title: 'Check humidity' },
    { title: 'Log results' },
  ]);
});

test('updateChecklistItem PATCHes the item endpoint with the given payload', async () => {
  const mockItem = { itemId: 9, title: 'Step', isCompleted: true, position: 0 };
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockItem,
  });

  const result = await updateChecklistItem(5, 9, { isCompleted: true }, 'tok');

  const [url, options] = (fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('/api/tasks/5/checklist/9');
  expect(options.method).toBe('PATCH');
  expect(options.headers.Authorization).toBe('Bearer tok');
  expect(JSON.parse(options.body)).toEqual({ isCompleted: true });
  expect(result).toEqual(mockItem);
});

test('updateChecklistItem throws with backend error detail on non-OK response', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Forbidden.' }),
  });

  await expect(
    updateChecklistItem(5, 9, { isCompleted: true }, 'tok'),
  ).rejects.toThrow('Forbidden.');
});

test('addChecklistItem POSTs the title to the checklist endpoint', async () => {
  const mockItem = { itemId: 12, title: 'New', isCompleted: false, position: 2 };
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockItem,
  });

  const result = await addChecklistItem(5, '  New  ', 'tok');

  const [url, options] = (fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('/api/tasks/5/checklist');
  expect(options.method).toBe('POST');
  expect(JSON.parse(options.body)).toEqual({ title: 'New' });
  expect(result).toEqual(mockItem);
});
