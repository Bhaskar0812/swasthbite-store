import { create } from "zustand";
import { notificationService } from "services/notificationService";
import { clearIncomingOrderAlert } from "services/incomingOrderAlertService";
import type { Notification } from "types";

type NotificationState = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const res = await notificationService.getAll();
      set({ notifications: res.data || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await notificationService.getUnreadCount();
      set({ unreadCount: res.data?.count || 0 });
    } catch {}
  },

  markRead: async (id) => {
    try {
      const current = useNotificationStore.getState().notifications.find((n) => n._id === id);
      await notificationService.markRead(id);
      const orderId = String(
        (current as any)?.data?.orderId ||
          (current as any)?.data?.subscription_id ||
          (current as any)?.data?.order_id ||
          "",
      ).trim();
      if (orderId) {
        await clearIncomingOrderAlert(orderId);
      }
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n._id === id ? { ...n, is_read: true } : n,
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {}
  },

  markAllRead: async () => {
    try {
      await notificationService.markAllRead();
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch {}
  },
}));
