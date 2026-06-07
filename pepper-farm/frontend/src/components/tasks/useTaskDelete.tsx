'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { cancelTask } from '@/services/tasks';
import type { Task } from '@/types/task';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Shared soft-delete flow for tasks (US42), used by both the Active Tasks and
 * History tabs so they present the same confirmation dialog and call the same
 * cancelTask API. The hook owns the dialog state and renders the dialog; the
 * caller supplies `onDeleted` to drop the task from its own list on success.
 */
export function useTaskDelete(onDeleted: (taskId: number) => void, overlayClassName?: string) {
  const { t } = useLanguage();
  const tk = t.tasks;
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const requestDelete = (task: Task) => {
    setDeleteError(null);
    setDeletingTask(task);
  };

  const close = () => {
    setDeletingTask(null);
    setDeleteError(null);
  };

  const handleConfirm = async () => {
    if (!deletingTask) return;
    const token = localStorage.getItem('token') ?? '';
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await cancelTask(deletingTask.id, token);
      // Soft-deleted on the server (status -> cancelled); drop it locally.
      onDeleted(deletingTask.id);
      setDeletingTask(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : tk.failedToDelete);
    } finally {
      setIsDeleting(false);
    }
  };

  const dialog = deletingTask ? (
    <Modal
      overlayClassName={overlayClassName}
      onClose={() => {
        if (isDeleting) return;
        close();
      }}
    >
      <h2 className="text-lg font-medium text-[var(--color-foreground)] mb-2">
        {tk.confirmDeleteTitle}
      </h2>
      <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
        {tk.confirmDeleteBody.replace('{title}', deletingTask.title)}
      </p>

      {deleteError && <Alert className="mb-4">{deleteError}</Alert>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={close} disabled={isDeleting}>
          {tk.cancelDelete}
        </Button>
        <Button onClick={handleConfirm} disabled={isDeleting}>
          {tk.confirmDelete}
        </Button>
      </div>
    </Modal>
  ) : null;

  return { requestDelete, dialog };
}
