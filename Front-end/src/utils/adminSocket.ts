import { io, Socket } from "socket.io-client";
import config from "src/config/config";

let socket: Socket | null = null;

/** Shared socket for admin dashboard and mobile visitor realtime updates */
export function getRealtimeSocket(): Socket {
  if (!socket) {
    const base = (config.apiUrl || "http://localhost:4000").replace(
      /\/api\/?$/,
      ""
    );
    socket = io(base, {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}

/** @deprecated use getRealtimeSocket */
export function getAdminSocket(): Socket {
  return getRealtimeSocket();
}
