'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { getMyTasks } from '@/services/tasks';
import type { Task } from '@/types/task';

const POLL_INTERVAL_MS = 30_000;

interface WorkerNotificationContextValue {
  /** Count of tasks assigned since page load */
  unreadCount: number;
  clearUnread: () => void;
  /** Tasks newly assigned since page load (most recent first) */
  newTasks: Task[];
  /** All currently active (non-done, non-cancelled) assigned tasks */
  activeTasks: Task[];
}

const WorkerNotificationContext = createContext<WorkerNotificationContextValue | null>(null);

export function WorkerNotificationProvider({ children }: { children: ReactNode }) {
  const seenIds   = useRef<Set<number>>(new Set());
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [newTasks,    setNewTasks]    = useState<Task[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);

  const handleNewTask = useCallback((task: Task) => {
    if (seenIds.current.has(task.id)) return;
    seenIds.current.add(task.id);
    // Only notify for active (not completed / cancelled) tasks
    if (task.status !== 'done' && task.status !== 'cancelled') {
      setNewTasks((prev) => [task, ...prev]);
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const token = localStorage.getItem('token') ?? '';
      try {
        const tasks = await getMyTasks(token);
        if (cancelled) return;

        // Seed silently — no unread bump for existing tasks
        const active = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
        setActiveTasks(active);
        tasks.forEach((t) => seenIds.current.add(t.id));
      } catch {
        // silent
      }

      if (cancelled) return;

      // Start polling for new assignments
      pollRef.current = setInterval(async () => {
        const tok = localStorage.getItem('token') ?? '';
        try {
          const tasks = await getMyTasks(tok);
          const active = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
          setActiveTasks(active);
          tasks.forEach(handleNewTask);
        } catch {
          // silent
        }
      }, POLL_INTERVAL_MS);
    }

    init();

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [handleNewTask]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <WorkerNotificationContext.Provider value={{ unreadCount, clearUnread, newTasks, activeTasks }}>
      {children}
    </WorkerNotificationContext.Provider>
  );
}

export function useWorkerNotification(): WorkerNotificationContextValue {
  const ctx = useContext(WorkerNotificationContext);
  if (!ctx) throw new Error('useWorkerNotification must be used inside <WorkerNotificationProvider>');
  return ctx;
}
