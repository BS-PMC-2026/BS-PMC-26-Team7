import { fireEvent, render, screen } from '@testing-library/react';
import TaskForm from '@/components/tasks/TaskForm';

const zones = [
  { ZoneId: 1, ZoneCode: 'GH-01', ZoneName: 'Greenhouse 1' },
  { ZoneId: 2, ZoneCode: 'NUR-01', ZoneName: 'Nursery' },
];

describe('TaskForm', () => {
  it('renders farm zones from the provided zone list', () => {
    render(<TaskForm onSubmit={jest.fn()} zones={zones} />);

    expect(screen.getByRole('option', { name: 'GH-01 - Greenhouse 1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'NUR-01 - Nursery' })).toBeInTheDocument();
  });

  it('submits the selected farm zone code', () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} zones={zones} />);

    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Water plants' } });
    fireEvent.change(screen.getByLabelText('Task Type *'), { target: { value: 'irrigation' } });
    fireEvent.change(screen.getByLabelText('Farm Zone'), { target: { value: 'GH-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ zoneCode: 'GH-01' }));
  });

  // ---- Checklist (US39) ----

  it('submits checklist items added by the user before create', () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} zones={zones} />);

    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Inspect' } });
    fireEvent.change(screen.getByLabelText('Task Type *'), { target: { value: 'inspection' } });

    const itemInput = screen.getByPlaceholderText('e.g. Check humidity');
    fireEvent.change(itemInput, { target: { value: 'Check humidity' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));

    fireEvent.change(itemInput, { target: { value: 'Check temperature' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add item' }));

    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        checklistItems: [
          { title: 'Check humidity' },
          { title: 'Check temperature' },
        ],
      }),
    );
  });

  it('does not show the checklist section when editing an existing task', () => {
    render(
      <TaskForm
        onSubmit={jest.fn()}
        zones={zones}
        initialData={{
          title: 'Existing',
          description: 'desc',
          taskType: 'inspection',
          priority: 'medium',
          assignedToUserId: '',
          dueDate: '',
          zoneCode: '',
          checklistItems: [],
        }}
      />,
    );
    expect(screen.queryByPlaceholderText('e.g. Check humidity')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add item' })).not.toBeInTheDocument();
  });
});
