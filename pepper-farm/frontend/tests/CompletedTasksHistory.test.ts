import { describe, test, expect, vi, beforeEach } from 'vitest';

async function getCompletedTasks() {
  const response = await fetch('/api/tasks/completed', {
    headers: {
      Authorization: 'Bearer ',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load completed tasks');
  }

  return response.json();
}

describe('Completed Tasks History', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('sends request to completed tasks endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    vi.stubGlobal('fetch', fetchMock);

    await getCompletedTasks();

    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/completed', {
      headers: {
        Authorization: 'Bearer ',
      },
    });
  });

  test('returns completed tasks list when request succeeds', async () => {
    const completedTasks = [
      {
        id: 1,
        title: 'Spray greenhouse',
        status: 'done',
        taskType: 'spray',
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => completedTasks,
      })
    );

    const result = await getCompletedTasks();

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('done');
    expect(result[0].title).toBe('Spray greenhouse');
  });

  test('throws error when request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      })
    );

    await expect(getCompletedTasks()).rejects.toThrow(
      'Failed to load completed tasks'
    );
  });
});