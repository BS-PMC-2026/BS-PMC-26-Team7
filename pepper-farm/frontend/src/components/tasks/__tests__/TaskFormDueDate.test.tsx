import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';
import TaskForm from '@/components/tasks/TaskForm';

// BSPMT7-449 — due date is required and supports a time component (datetime-local).

function renderForm(props: Partial<Parameters<typeof TaskForm>[0]> = {}) {
  const onSubmit = (props.onSubmit as jest.Mock) ?? jest.fn();
  return render(
    <LanguageProvider>
      <TaskForm onSubmit={onSubmit} {...props} />
    </LanguageProvider>,
  );
}

describe('TaskForm – due date (BSPMT7-449)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the due date input as datetime-local', () => {
    renderForm();
    const dueDate = screen.getByLabelText(/Due Date/i) as HTMLInputElement;
    expect(dueDate.type).toBe('datetime-local');
  });

  it('blocks submit and shows the required message when due date is empty', () => {
    const onSubmit = jest.fn();
    renderForm({ onSubmit });

    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'My task' } });
    fireEvent.change(screen.getByLabelText(/Task Type/i), { target: { value: 'irrigation' } });
    // Deliberately leave due date empty.

    fireEvent.click(screen.getByText('Create Task'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Due date and time are required.')).toBeInTheDocument();
  });

  it('submits the chosen date + time when a due date is provided', () => {
    const onSubmit = jest.fn();
    renderForm({ onSubmit });

    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'My task' } });
    fireEvent.change(screen.getByLabelText(/Task Type/i), { target: { value: 'irrigation' } });
    fireEvent.change(screen.getByLabelText(/Due Date/i), {
      target: { value: '2030-12-31T10:30' },
    });

    fireEvent.click(screen.getByText('Create Task'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].dueDate).toBe('2030-12-31T10:30');
  });

  it('rejects a due date in the past', () => {
    const onSubmit = jest.fn();
    renderForm({ onSubmit });

    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'My task' } });
    fireEvent.change(screen.getByLabelText(/Task Type/i), { target: { value: 'irrigation' } });
    fireEvent.change(screen.getByLabelText(/Due Date/i), {
      target: { value: '2000-01-01T08:00' },
    });

    fireEvent.click(screen.getByText('Create Task'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Due date cannot be in the past.')).toBeInTheDocument();
  });
});
