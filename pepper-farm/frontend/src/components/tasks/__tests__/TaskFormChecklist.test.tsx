import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';
import TaskForm from '@/components/tasks/TaskForm';
import { ChecklistFormItem } from '@/types/task';

function renderForm(props: Partial<Parameters<typeof TaskForm>[0]> = {}) {
  const onSubmit = (props.onSubmit as jest.Mock) ?? jest.fn();
  return render(
    <LanguageProvider>
      <TaskForm onSubmit={onSubmit} {...props} />
    </LanguageProvider>,
  );
}

describe('TaskForm – checklist section', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the checklist section in create mode (no initialData)', () => {
    renderForm();
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. Check humidity'),
    ).toBeInTheDocument();
    expect(screen.getByText('+ Add item')).toBeInTheDocument();
  });

  it('renders the checklist section in edit mode (initialData present)', () => {
    renderForm({ initialData: { title: 'Existing task', taskType: 'irrigation' } });
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByText('+ Add item')).toBeInTheDocument();
  });

  it('renders existing checklist items as editable inputs in edit mode', () => {
    const checklistItems: ChecklistFormItem[] = [
      { itemId: 1, title: 'Step one', isCompleted: false },
      { itemId: 2, title: 'Step two', isCompleted: true },
    ];
    renderForm({ initialData: { title: 'T', taskType: 'irrigation', checklistItems } });

    // Each item should render as an editable input with aria-label "Edit item"
    const editInputs = screen.getAllByRole('textbox', { name: 'Edit item' });
    expect(editInputs).toHaveLength(2);
    expect((editInputs[0] as HTMLInputElement).value).toBe('Step one');
    expect((editInputs[1] as HTMLInputElement).value).toBe('Step two');
  });

  it('edits a checklist item text without changing its position', () => {
    const checklistItems: ChecklistFormItem[] = [
      { itemId: 1, title: 'Old title', isCompleted: false },
      { itemId: 2, title: 'Unchanged', isCompleted: false },
    ];
    renderForm({ initialData: { title: 'T', taskType: 'irrigation', checklistItems } });

    const editInputs = screen.getAllByRole('textbox', { name: 'Edit item' });
    fireEvent.change(editInputs[0], { target: { value: 'New title' } });

    const after = screen.getAllByRole('textbox', { name: 'Edit item' });
    expect((after[0] as HTMLInputElement).value).toBe('New title');
    // Second item stays at position 1
    expect((after[1] as HTMLInputElement).value).toBe('Unchanged');
  });

  it('removes only the selected checklist item', () => {
    const checklistItems: ChecklistFormItem[] = [
      { itemId: 1, title: 'Keep me', isCompleted: false },
      { itemId: 2, title: 'Remove me', isCompleted: false },
    ];
    renderForm({ initialData: { title: 'T', taskType: 'irrigation', checklistItems } });

    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[1]); // remove second item

    const after = screen.getAllByRole('textbox', { name: 'Edit item' });
    expect(after).toHaveLength(1);
    expect((after[0] as HTMLInputElement).value).toBe('Keep me');
  });

  it('adds a new checklist item via the Add item button', () => {
    renderForm();
    const addInput = screen.getByPlaceholderText('e.g. Check humidity');
    fireEvent.change(addInput, { target: { value: 'New step' } });
    fireEvent.click(screen.getByText('+ Add item'));

    const editInputs = screen.getAllByRole('textbox', { name: 'Edit item' });
    expect(editInputs).toHaveLength(1);
    expect((editInputs[0] as HTMLInputElement).value).toBe('New step');
    // Input field is cleared after adding
    expect((addInput as HTMLInputElement).value).toBe('');
  });

  it('adds a new checklist item via the Enter key', () => {
    renderForm();
    const addInput = screen.getByPlaceholderText('e.g. Check humidity');
    fireEvent.change(addInput, { target: { value: 'Enter step' } });
    fireEvent.keyDown(addInput, { key: 'Enter', code: 'Enter' });

    const editInputs = screen.getAllByRole('textbox', { name: 'Edit item' });
    expect(editInputs).toHaveLength(1);
    expect((editInputs[0] as HTMLInputElement).value).toBe('Enter step');
  });

  it('does not add an empty item when Add item is clicked', () => {
    renderForm();
    fireEvent.click(screen.getByText('+ Add item'));
    expect(screen.queryByRole('textbox', { name: 'Edit item' })).toBeNull();
  });

  it('does not add a whitespace-only item', () => {
    renderForm();
    const addInput = screen.getByPlaceholderText('e.g. Check humidity');
    fireEvent.change(addInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('+ Add item'));
    expect(screen.queryByRole('textbox', { name: 'Edit item' })).toBeNull();
  });

  it('shows "No checklist items" placeholder when list is empty', () => {
    renderForm();
    expect(screen.getByText('No checklist items')).toBeInTheDocument();
  });

  it('hides "No checklist items" placeholder after the first item is added', () => {
    renderForm();
    const addInput = screen.getByPlaceholderText('e.g. Check humidity');
    fireEvent.change(addInput, { target: { value: 'First item' } });
    fireEvent.click(screen.getByText('+ Add item'));
    expect(screen.queryByText('No checklist items')).toBeNull();
  });

  it('passes checklist items to onSubmit when form is valid', () => {
    const onSubmit = jest.fn();
    renderForm({ onSubmit });

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: 'My task' },
    });
    fireEvent.change(screen.getByLabelText(/Task Type/i), {
      target: { value: 'irrigation' },
    });
    fireEvent.change(screen.getByLabelText(/Due Date/i), {
      target: { value: '2030-12-31T10:00' },
    });

    // Add checklist item
    const addInput = screen.getByPlaceholderText('e.g. Check humidity');
    fireEvent.change(addInput, { target: { value: 'Check A' } });
    fireEvent.click(screen.getByText('+ Add item'));

    fireEvent.click(screen.getByText('Create Task'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submittedData = onSubmit.mock.calls[0][0];
    expect(submittedData.checklistItems).toHaveLength(1);
    expect(submittedData.checklistItems[0].title).toBe('Check A');
    expect(submittedData.checklistItems[0].isCompleted).toBe(false);
  });
});
