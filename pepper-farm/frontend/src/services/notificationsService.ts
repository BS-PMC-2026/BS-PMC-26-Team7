import { apiFetch } from './api';

export interface AppNotification {
  notificationId: number;
  userId: number;
  title: string;
  message: string | null;
  notificationType: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  createdAtUtc: string;
  readAtUtc: string | null;
}

export interface UnreadCountResult {
  unreadCount: number;
}

export async function getMyNotifications(): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>('/api/notifications');
}

export async function getUnreadCount(): Promise<UnreadCountResult> {
  return apiFetch<UnreadCountResult>('/api/notifications/unread-count', { timeoutMs: 5000 });
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await apiFetch<unknown>(`/api/notifications/${notificationId}/read`, { method: 'PUT' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<unknown>('/api/notifications/mark-all-read', { method: 'PUT' });
}
