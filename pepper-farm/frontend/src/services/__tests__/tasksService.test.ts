import { syncChecklistItems } from '@/services/tasks';
import { ChecklistItem, ChecklistFormItem } from '@/types/task';

const TOKEN = 'test-token';
const TASK_ID = 42;

function makeOriginal(
  items: Array<{ itemId: number; title: string; isCompleted?: boolean }>,
): ChecklistItem[] {
  return items.map((item, idx) => ({
    itemId: item.itemId,
    title: item.title,
    isCompleted: item.isCompleted ?? false,
    position: idx,
  }));
}

function makeUpdated(
  items: Array<{ itemId?: number; title: string; isCompleted?: boolean }>,
): ChecklistFormItem[] {
  return items.map((item) => ({
    itemId: item.itemId,
    title: item.title,
    isCompleted: item.isCompleted ?? false,
  }));
}

let fetchMock: jest.Mock;

function mockResponses(
  responses: Array<{ ok?: boolean; body?: object; status?: number }>,
): void {
  for (const resp of responses) {
    const ok = resp.ok ?? true;
    fetchMock.mockResolvedValueOnce({
      ok,
      status: resp.status ?? (ok ? 200 : 400),
      json: () => Promise.resolve(resp.body ?? {}),
    } as unknown as Response);
  }
}

beforeEach(() => {
  fetchMock = jest.fn();
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  localStorage.clear();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('syncChecklistItems', () => {
  it('returns [] and makes no requests when both lists are empty', async () => {
    const result = await syncChecklistItems(TASK_ID, [], [], TOKEN);
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the original item unchanged when title is identical', async () => {
    const original = makeOriginal([{ itemId: 1, title: 'Step A' }]);
    const updated = makeUpdated([{ itemId: 1, title: 'Step A' }]);

    const result = await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ itemId: 1, title: 'Step A' });
  });

  it('DELETEs removed items and excludes them from the result', async () => {
    const original = makeOriginal([
      { itemId: 1, title: 'Keep' },
      { itemId: 2, title: 'Remove me' },
    ]);
    const updated = makeUpdated([{ itemId: 1, title: 'Keep' }]);
    mockResponses([{ status: 204 }]);

    const result = await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/checklist/2`);
    expect((init as RequestInit).method).toBe('DELETE');
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe(1);
  });

  it('PATCHes items whose title changed and returns the server response', async () => {
    const original = makeOriginal([{ itemId: 5, title: 'Old Title' }]);
    const updated = makeUpdated([{ itemId: 5, title: 'New Title' }]);
    const serverItem: ChecklistItem = {
      itemId: 5,
      title: 'New Title',
      isCompleted: false,
      position: 0,
    };
    mockResponses([{ body: serverItem }]);

    const result = await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/checklist/5`);
    expect((init as RequestInit).method).toBe('PATCH');
    expect(result[0].title).toBe('New Title');
  });

  it('POSTs items without itemId and returns the created item from server', async () => {
    const original = makeOriginal([]);
    const updated = makeUpdated([{ title: 'New step' }]);
    const created: ChecklistItem = {
      itemId: 99,
      title: 'New step',
      isCompleted: false,
      position: 0,
    };
    mockResponses([{ status: 201, body: created }]);

    const result = await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/api/tasks/${TASK_ID}/checklist`);
    expect((init as RequestInit).method).toBe('POST');
    expect(result[0].itemId).toBe(99);
  });

  it('skips items with blank-only title without making any request', async () => {
    const original = makeOriginal([]);
    const updated = makeUpdated([{ title: '   ' }]);

    const result = await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  it('does not PATCH when title is identical to original', async () => {
    const original = makeOriginal([{ itemId: 3, title: 'Same title' }]);
    const updated = makeUpdated([{ itemId: 3, title: 'Same title' }]);

    await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    const patchCalls = (fetchMock.mock.calls as [string, RequestInit][]).filter(
      ([, init]) => init?.method === 'PATCH',
    );
    expect(patchCalls).toHaveLength(0);
  });

  it('does not DELETE items that are still present in the updated list', async () => {
    const original = makeOriginal([{ itemId: 7, title: 'Exists' }]);
    const updated = makeUpdated([{ itemId: 7, title: 'Exists' }]);

    await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    const deleteCalls = (fetchMock.mock.calls as [string, RequestInit][]).filter(
      ([, init]) => init?.method === 'DELETE',
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it('handles all three operations in one sync: delete, patch, create', async () => {
    const original = makeOriginal([
      { itemId: 1, title: 'Unchanged' },
      { itemId: 2, title: 'Old name' },
      { itemId: 3, title: 'Will be deleted' },
    ]);
    const updated = makeUpdated([
      { itemId: 1, title: 'Unchanged' },
      { itemId: 2, title: 'New name' },
      { title: 'Brand new' },
    ]);
    const patchedItem: ChecklistItem = { itemId: 2, title: 'New name', isCompleted: false, position: 1 };
    const createdItem: ChecklistItem = { itemId: 10, title: 'Brand new', isCompleted: false, position: 3 };
    mockResponses([
      { status: 204 },                         // DELETE item 3
      { body: patchedItem },                   // PATCH item 2
      { status: 201, body: createdItem },      // POST brand new
    ]);

    const result = await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ itemId: 1, title: 'Unchanged' }); // unchanged original
    expect(result[1]).toMatchObject({ itemId: 2, title: 'New name' });  // patched
    expect(result[2]).toMatchObject({ itemId: 10, title: 'Brand new' }); // created
  });

  it('deletes all items when updated list is empty', async () => {
    const original = makeOriginal([
      { itemId: 1, title: 'A' },
      { itemId: 2, title: 'B' },
    ]);
    mockResponses([{ status: 204 }, { status: 204 }]);

    const result = await syncChecklistItems(TASK_ID, original, [], TOKEN);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(0);
  });

  it('throws when an API call fails, propagating the server error message', async () => {
    const original = makeOriginal([]);
    const updated = makeUpdated([{ title: 'New item' }]);
    mockResponses([{ ok: false, status: 400, body: { detail: 'Task not found.' } }]);

    await expect(
      syncChecklistItems(TASK_ID, original, updated, TOKEN),
    ).rejects.toThrow('Task not found.');
  });

  it('sends the Bearer token in every request', async () => {
    const original = makeOriginal([]);
    const updated = makeUpdated([{ title: 'Check item' }]);
    const created: ChecklistItem = { itemId: 55, title: 'Check item', isCompleted: false, position: 0 };
    mockResponses([{ status: 201, body: created }]);

    await syncChecklistItems(TASK_ID, original, updated, TOKEN);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${TOKEN}`);
  });
});
