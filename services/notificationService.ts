import api from "./api";

export const notificationService = {
  getAll: async () => {
    const res = await api.get("/notifications");
    return res.data;
  },
  getUnreadCount: async () => {
    const res = await api.get("/notifications/unread-count");
    return res.data;
  },
  markRead: async (id: string) => {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.put("/notifications/read-all");
    return res.data;
  },
};
