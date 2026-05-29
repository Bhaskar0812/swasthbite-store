import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectSocket = (token: string, storeId?: string) => {
  if (socket?.connected) return socket;

  socket = io("https://api.swasthbite.in", {
    auth: { token, role: "admin", storeId },
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    console.log("🔌 Socket connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 Socket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.log("🔌 Socket error:", error.message);
  });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
