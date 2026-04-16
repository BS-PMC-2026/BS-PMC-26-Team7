import { fireEvent, render, screen } from '@testing-library/react';
import TaskFilters from '@/components/tasks/TaskFilters';

describe('TaskFilters', () => {
  it('changes importance and type filters', () => {
    const onPriorityChange = jest.fn();
    const onTaskTypeChange = jest.fn();

    render(
      <TaskFilters
        priority=""
        taskType=""
        totalCount={4}
        resultCount={4}
        onPriorityChange={onPriorityChange}
        onTaskTypeChange={onTaskTypeChange}
        onClear={jest.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Importance'), { target: { value: 'critical' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'inspection' } });

    expect(onPriorityChange).toHaveBeenCalledWith('critical');
    expect(onTaskTypeChange).toHaveBeenCalledWith('inspection');
    expect(screen.getByText('Showing 4 of 4')).toBeInTheDocument();
  });

  it('shows clear when filters are active', () => {
    const onClear = jest.fn();

    render(
      <TaskFilters
        priority="high"
        taskType="irrigation"
        totalCount={4}
        resultCount={1}
        onPriorityChange={jest.fn()}
        onTaskTypeChange={jest.fn()}
        onClear={onClear}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalled();
    expect(screen.getByText('Showing 1 of 4')).toBeInTheDocument();
  });
});
