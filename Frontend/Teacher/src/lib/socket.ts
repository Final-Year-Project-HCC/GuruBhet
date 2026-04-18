import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.gurubhet.tech";

/**
 * Singleton Socket.IO client for the Teacher app.
 * - Uses cookie-based auth (withCredentials) — no token injection.
 * - autoConnect is disabled; call connectSocket() explicitly after auth.
 */
const socket: Socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  transports: ["websocket"],
});

/* ── Lifecycle logging ─────────────────────────────────────────────── */

socket.on("connect", () => {
  console.log("[socket] connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("[socket] disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("[socket] connection error:", err.message);
});

/* ── Helpers ───────────────────────────────────────────────────────── */

export function connectSocket() {
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export default socket;
