import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';
import TaskCard from '@/components/tasks/TaskCard';
import { ChecklistItem, Task } from '@/types/task';

function makeTask(items: Array<{ itemId: number; title: string; isCompleted: boolean }>): Task {
  return {
    id: 1,
    title: 'Test task',
    description: null,
    status: 'todo',
    priority: 'medium',
    taskType: 'inspection',
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
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    checklistItems: items.map((i, idx) => ({ ...i, position: idx })),
  };
}

function renderCard(task: Task, onToggle?: jest.Mock) {
  return render(
    <LanguageProvider>
      <TaskCard task={task} workers={[]} onToggleChecklistItem={onToggle} />
    </LanguageProvider>,
  );
}

describe('TaskCard – progress bar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not render a progress bar when the task has no checklist items', () => {
    renderCard(makeTask([]));
    expect(screen.queryByTestId('checklist-progress-bar')).toBeNull();
  });

  it('renders a progress bar when the task has checklist items', () => {
    renderCard(makeTask([{ itemId: 1, title: 'Step', isCompleted: false }]));
    expect(screen.getByTestId('checklist-progress-bar')).toBeInTheDocument();
  });

  it('shows 0% width when no items are completed', () => {
    const task = makeTask([
      { itemId: 1, title: 'A', isCompleted: false },
      { itemId: 2, title: 'B', isCompleted: false },
    ]);
    renderCard(task);
    const bar = screen.getByTestId('checklist-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('0%');
  });

  it('shows 50% width when half the items are completed (2 of 4)', () => {
    const task = makeTask([
      { itemId: 1, title: 'A', isCompleted: true },
      { itemId: 2, title: 'B', isCompleted: true },
      { itemId: 3, title: 'C', isCompleted: false },
      { itemId: 4, title: 'D', isCompleted: false },
    ]);
    renderCard(task);
    const bar = screen.getByTestId('checklist-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('shows 100% width when all items are completed', () => {
    const task = makeTask([
      { itemId: 1, title: 'A', isCompleted: true },
      { itemId: 2, title: 'B', isCompleted: true },
    ]);
    renderCard(task);
    const bar = screen.getByTestId('checklist-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('shows the correct "x / y completed" caption', () => {
    const task = makeTask([
      { itemId: 1, title: 'A', isCompleted: true },
      { itemId: 2, title: 'B', isCompleted: false },
      { itemId: 3, title: 'C', isCompleted: false },
    ]);
    renderCard(task);
    expect(screen.getByText('1 / 3 completed')).toBeInTheDocument();
  });

  it('shows "3 / 3 completed" when all items are done', () => {
    const task = makeTask([
      { itemId: 1, title: 'A', isCompleted: true },
      { itemId: 2, title: 'B', isCompleted: true },
      { itemId: 3, title: 'C', isCompleted: true },
    ]);
    renderCard(task);
    expect(screen.getByText('3 / 3 completed')).toBeInTheDocument();
    const bar = screen.getByTestId('checklist-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('progress calculation is correct for various ratios', () => {
    const cases: [number, number][] = [
      [1, 3],
      [3, 4],
      [0, 5],
      [5, 5],
    ];

    for (const [done, total] of cases) {
      const items = Array.from({ length: total }, (_, i) => ({
        itemId: i + 1,
        title: `Item ${i + 1}`,
        isCompleted: i < done,
      }));
      const { unmount } = renderCard(makeTask(items));
      const bar = screen.getByTestId('checklist-progress-bar') as HTMLElement;
      const actualWidth = parseFloat(bar.style.width);
      const expectedWidth = (done / total) * 100;
      expect(actualWidth).toBeCloseTo(expectedWidth, 5);
      unmount();
    }
  });

  it('checkboxes are disabled when onToggleChecklistItem is not provided', () => {
    const task = makeTask([{ itemId: 1, title: 'Step', isCompleted: false }]);
    renderCard(task); // no toggle callback
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox).toBeDisabled();
  });

  it('checkboxes are enabled when onToggleChecklistItem is provided', () => {
    const task = makeTask([{ itemId: 1, title: 'Step', isCompleted: false }]);
    renderCard(task, jest.fn());
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox).not.toBeDisabled();
  });
});
