'use client';

import { useState } from 'react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { CreateTaskFormData, TaskPriority } from '@/types/task';
import { Worker } from '@/types/user';
import type { ZoneSummary } from '@/services/zones';
import { useLanguage } from '@/context/LanguageContext';
import { translateEnum } from '@/i18n/dictionaries';

interface TaskFormProps {
  onSubmit: (data: CreateTaskFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  workers?: Worker[];
  zones?: ZoneSummary[];
  initialData?: Partial<CreateTaskFormData>;
  submitLabel?: string;
}

interface FormErrors {
  title?: string;
  taskType?: string;
  dueDate?: string;
}

export default function TaskForm({
  onSubmit,
  onCancel,
  isLoading = false,
  workers = [],
  zones = [],
  initialData,
  submitLabel,
}: TaskFormProps) {
  const { t } = useLanguage();
  const tk = t.tasks;

  const [form, setForm] = useState<CreateTaskFormData>({
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    taskType: initialData?.taskType ?? '',
    priority: initialData?.priority ?? 'medium',
    assignedToUserId: initialData?.assignedToUserId ?? '',
    dueDate: initialData?.dueDate ?? '',
    zoneCode: initialData?.zoneCode ?? '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.title.trim()) next.title = tk.errTitleRequired;
    if (!form.taskType)      next.taskType = tk.errTypeRequired;
    if (form.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(form.dueDate) < today) next.dueDate = tk.errDueDatePast;
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

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(form);
  };

  const priorityOptions: Array<{ value: TaskPriority; label: string }> = [
    { value: 'low',      label: translateEnum('low',      t.enums.priority) },
    { value: 'medium',   label: translateEnum('medium',   t.enums.priority) },
    { value: 'high',     label: translateEnum('high',     t.enums.priority) },
    { value: 'critical', label: translateEnum('critical', t.enums.priority) },
  ];

  const taskTypeOptions = [
    { value: '',             label: tk.formSelectType },
    { value: 'irrigation',  label: translateEnum('irrigation',  t.enums.taskType) },
    { value: 'harvesting',  label: translateEnum('harvesting',  t.enums.taskType) },
    { value: 'planting',    label: translateEnum('planting',    t.enums.taskType) },
    { value: 'fertilizing', label: translateEnum('fertilizing', t.enums.taskType) },
    { value: 'inspection',  label: translateEnum('inspection',  t.enums.taskType) },
    { value: 'other',       label: translateEnum('other',       t.enums.taskType) },
  ];

  const defaultLabel = initialData ? tk.formSaveChanges : tk.formCreateTask;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        id="title"
        label={tk.formTitle}
        placeholder={tk.titlePlaceholder}
        value={form.title}
        onChange={(e) => handleChange('title', e.target.value)}
        error={errors.title}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-gray-700">
          {tk.formDescription}
        </label>
        <textarea
          id="description"
          rows={3}
          placeholder={tk.descriptionPlaceholder}
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      </div>

      <Select
        id="taskType"
        label={tk.formTaskType}
        options={taskTypeOptions}
        value={form.taskType}
        onChange={(e) => handleChange('taskType', e.target.value)}
        error={errors.taskType}
      />

      <Select
        id="priority"
        label={tk.formPriority}
        options={priorityOptions}
        value={form.priority}
        onChange={(e) => handleChange('priority', e.target.value as TaskPriority)}
      />

      <Input
        id="dueDate"
        label={tk.formDueDate}
        type="date"
        value={form.dueDate}
        onChange={(e) => handleChange('dueDate', e.target.value)}
        error={errors.dueDate}
      />

      <Select
        id="zoneCode"
        label={tk.formZone}
        options={[
          { value: '', label: tk.formNoZone },
          ...zones.map((zone) => ({
            value: zone.ZoneCode,
            label: `${zone.ZoneCode} - ${zone.ZoneName}`,
          })),
        ]}
        value={form.zoneCode}
        onChange={(e) => handleChange('zoneCode', e.target.value)}
      />

      <Select
        id="assignedToUserId"
        label={tk.formAssignTo}
        options={[
          { value: '', label: tk.formUnassigned },
          ...workers.map((w) => ({ value: String(w.userId), label: w.fullName })),
        ]}
        value={form.assignedToUserId}
        onChange={(e) => handleChange('assignedToUserId', e.target.value)}
      />

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t.common.cancel}
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? tk.formSaving : (submitLabel ?? defaultLabel)}
        </Button>
      </div>
    </form>
  );
}
