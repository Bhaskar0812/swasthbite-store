import api from "./api";

export const chatService = {
  getSessions: async () => {
    const res = await api.get("/chat/store/sessions");
    return res.data;
  },
  acceptChat: async (sessionId: string) => {
    const res = await api.put(`/chat/${sessionId}/accept`);
    return res.data;
  },
  endChat: async (sessionId: string) => {
    const res = await api.put(`/chat/${sessionId}/end`);
    return res.data;
  },
  sendMessage: async (sessionId: string, content: string) => {
    const res = await api.post(`/chat/${sessionId}/send`, { content });
    return res.data;
  },
  uploadImage: async (sessionId: string, formData: FormData) => {
    const res = await api.post(`/chat/${sessionId}/upload-image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};
