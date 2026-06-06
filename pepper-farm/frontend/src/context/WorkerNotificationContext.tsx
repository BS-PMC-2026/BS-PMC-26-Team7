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
import {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/services/notificationsService';
import type { AppNotification } from '@/services/notificationsService';

const POLL_INTERVAL_MS = 30_000;
const NOTIF_POLL_MS   = 60_000;

interface WorkerNotificationContextValue {
  /** Count of tasks assigned since page load */
  unreadCount: number;
  clearUnread: () => void;
  /** Tasks newly assigned since page load (most recent first) */
  newTasks: Task[];
  /** All currently active (non-done, non-cancelled) assigned tasks */
  activeTasks: Task[];

  /** Shared in-app notification list (manager announcements + system messages) */
  appNotifs: AppNotification[];
  /** Unread count for the bell badge */
  appUnreadCount: number;
  /** Reload the full notification list from the server */
  loadAppNotifs: () => Promise<void>;
  /** Mark one notification as read and remove it from the unread count */
  dismissAppNotif: (id: number) => Promise<void>;
  /** Mark all notifications as read */
  markAllAppNotifsRead: () => Promise<void>;
}

const WorkerNotificationContext = createContext<WorkerNotificationContextValue | null>(null);

export function WorkerNotificationProvider({ children }: { children: ReactNode }) {
  const seenIds   = useRef<Set<number>>(new Set());
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [newTasks,    setNewTasks]    = useState<Task[]>([]);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);

  // --- App notifications (shared between dashboard panel and bell panel) ---
  const [appNotifs,       setAppNotifs]       = useState<AppNotification[]>([]);
  const [appUnreadCount,  setAppUnreadCount]   = useState(0);

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

      // Start polling for new task assignments
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

  // Poll app notification unread count every 60 s
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { unreadCount: count } = await getUnreadCount();
        if (!cancelled) setAppUnreadCount(count);
      } catch { /* table not yet created — ignore */ }
    };
    poll();
    const id = setInterval(poll, NOTIF_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const loadAppNotifs = useCallback(async () => {
    try {
      const list = await getMyNotifications();
      setAppNotifs(list);
      setAppUnreadCount(list.filter((n) => !n.isRead).length);
    } catch { /* ignore */ }
  }, []);

  const dismissAppNotif = useCallback(async (id: number) => {
    try {
      await markNotificationRead(id);
      setAppNotifs((prev) => prev.map((n) => n.notificationId === id ? { ...n, isRead: true } : n));
      setAppUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  }, []);

  const markAllAppNotifsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setAppNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setAppUnreadCount(0);
    } catch { /* ignore */ }
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <WorkerNotificationContext.Provider value={{
      unreadCount, clearUnread, newTasks, activeTasks,
      appNotifs, appUnreadCount, loadAppNotifs, dismissAppNotif, markAllAppNotifsRead,
    }}>
      {children}
    </WorkerNotificationContext.Provider>
  );
}

export function useWorkerNotification(): WorkerNotificationContextValue {
  const ctx = useContext(WorkerNotificationContext);
  if (!ctx) throw new Error('useWorkerNotification must be used inside <WorkerNotificationProvider>');
  return ctx;
}
