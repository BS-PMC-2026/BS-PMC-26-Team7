import { describe, test, expect, vi, beforeEach } from 'vitest';

async function deletePepper(pepperId: number): Promise<void> {
  const response = await fetch(`/api/peppers/${pepperId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete pepper');
  }
}

describe('Delete Pepper Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('sends DELETE request to correct endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });

    vi.stubGlobal('fetch', fetchMock);

    await deletePepper(46);

    expect(fetchMock).toHaveBeenCalledWith('/api/peppers/46', {
      method: 'DELETE',
    });
  });

  test('does not throw error when delete succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
      })
    );

    await expect(deletePepper(46)).resolves.toBeUndefined();
  });

  test('throws error when delete fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      })
    );

    await expect(deletePepper(46)).rejects.toThrow('Failed to delete pepper');
  });
});