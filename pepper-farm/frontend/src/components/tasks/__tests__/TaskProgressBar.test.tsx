import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';
import TaskProgressBar from '@/components/tasks/TaskProgressBar';
import { ChecklistItem } from '@/types/task';

function makeItems(specs: Array<{ done: boolean }>): ChecklistItem[] {
  return specs.map((s, i) => ({
    itemId: i + 1,
    title: `Item ${i + 1}`,
    isCompleted: s.done,
    position: i,
  }));
}

function renderBar(items: ChecklistItem[]) {
  return render(
    <LanguageProvider>
      <TaskProgressBar checklistItems={items} />
    </LanguageProvider>,
  );
}

describe('TaskProgressBar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders nothing when checklistItems is empty', () => {
    const { container } = renderBar([]);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('task-progress-bar')).toBeNull();
  });

  it('renders a progress bar when there are checklist items', () => {
    renderBar(makeItems([{ done: false }]));
    expect(screen.getByTestId('task-progress-bar')).toBeInTheDocument();
  });

  it('shows 0% width when no items are completed', () => {
    renderBar(makeItems([{ done: false }, { done: false }]));
    const bar = screen.getByTestId('task-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('0%');
  });

  it('shows 50% width when 1 of 2 items is completed', () => {
    renderBar(makeItems([{ done: true }, { done: false }]));
    const bar = screen.getByTestId('task-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('shows 100% width when all items are completed', () => {
    renderBar(makeItems([{ done: true }, { done: true }]));
    const bar = screen.getByTestId('task-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('shows the correct "x / y completed" caption', () => {
    renderBar(makeItems([{ done: true }, { done: false }, { done: false }]));
    expect(screen.getByText('1 / 3 completed')).toBeInTheDocument();
  });

  it('rounds percent correctly: 1 of 3 is 33%', () => {
    renderBar(makeItems([{ done: true }, { done: false }, { done: false }]));
    const bar = screen.getByTestId('task-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('33%');
  });
});
