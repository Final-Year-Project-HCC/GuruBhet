import { useEffect } from "react";
import socket from "@/lib/socket";

export interface SocketEventEntry {
  event: string;
  handler: (...args: unknown[]) => void;
}

/**
 * Generic hook that subscribes to an array of socket events on mount
 * and performs mandatory socket.off cleanup on unmount to prevent
 * listener accumulation.
 */
export function useSocketEvents(events: SocketEventEntry[]) {
  useEffect(() => {
    events.forEach(({ event, handler }) => {
      socket.on(event, handler);
    });

    return () => {
      events.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
