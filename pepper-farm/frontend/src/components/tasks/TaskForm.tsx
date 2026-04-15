'use client';

import { useState } from 'react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { CreateTaskFormData, TaskPriority } from '@/types/task';
import { Worker } from '@/types/user';
import { ZoneSummary } from '@/services/zones';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const TASK_TYPE_OPTIONS = [
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'harvesting', label: 'Harvesting' },
  { value: 'planting', label: 'Planting' },
  { value: 'fertilizing', label: 'Fertilizing' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

interface TaskFormProps {
  onSubmit: (data: CreateTaskFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  workers?: Worker[];
  zones?: ZoneSummary[];
}

interface FormErrors {
  title?: string;
  taskType?: string;
  dueDate?: string;
}

export default function TaskForm({ onSubmit, onCancel, isLoading = false, workers = [], zones = [] }: TaskFormProps) {
  const [form, setForm] = useState<CreateTaskFormData>({
    title: '',
    description: '',
    taskType: '',
    priority: 'medium',
    assignedToUserId: '',
    dueDate: '',
    zoneId: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!form.title.trim()) next.title = 'Title is required.';
    if (!form.taskType) next.taskType = 'Task type is required.';

    if (form.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(form.dueDate) < today) next.dueDate = 'Due date cannot be in the past.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (field: keyof CreateTaskFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        id="title"
        label="Title *"
        placeholder="e.g. Water zone A"
        value={form.title}
        onChange={(e) => handleChange('title', e.target.value)}
        error={errors.title}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          placeholder="Optional details about the task..."
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>

      <Select
        id="taskType"
        label="Task Type *"
        options={[{ value: '', label: 'Select a type...' }, ...TASK_TYPE_OPTIONS]}
        value={form.taskType}
        onChange={(e) => handleChange('taskType', e.target.value)}
        error={errors.taskType}
      />

      <Select
        id="priority"
        label="Priority"
        options={PRIORITY_OPTIONS}
        value={form.priority}
        onChange={(e) => handleChange('priority', e.target.value as TaskPriority)}
      />

      <Input
        id="dueDate"
        label="Due Date"
        type="date"
        value={form.dueDate}
        onChange={(e) => handleChange('dueDate', e.target.value)}
        error={errors.dueDate}
      />

      <Select
        id="zoneId"
        label="Farm Zone"
        options={[
          { value: '', label: 'No zone' },
          ...zones.map((z) => ({ value: String(z.ZoneId), label: `${z.ZoneCode} — ${z.ZoneName}` })),
        ]}
        value={form.zoneId}
        onChange={(e) => handleChange('zoneId', e.target.value)}
      />

      <Select
        id="assignedToUserId"
        label="Assign to Worker"
        options={[
          { value: '', label: 'Unassigned' },
          ...workers.map((w) => ({ value: String(w.userId), label: w.fullName })),
        ]}
        value={form.assignedToUserId}
        onChange={(e) => handleChange('assignedToUserId', e.target.value)}
      />

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}
