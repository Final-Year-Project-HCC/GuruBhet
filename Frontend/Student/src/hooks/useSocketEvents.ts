import { useEffect, useRef } from "react";
import socket from "@/lib/socket";

export interface SocketEventEntry {
  event: string;
  handler: (...args: unknown[]) => void;
}

/**
 * Generic hook that subscribes to an array of socket events on mount
 * and performs mandatory socket.off cleanup on unmount to prevent
 * listener accumulation.
 *
 * Uses a ref so that the registered socket listeners always invoke
 * the latest handler without needing to re-subscribe on every render.
 * This prevents stale-closure bugs where captured state (e.g. activeRoom)
 * is forever null because the handler was only captured at mount time.
 */
export function useSocketEvents(events: SocketEventEntry[]) {
  const eventsRef = useRef(events);
  // Keep the ref current on every render so socket callbacks see fresh state
  eventsRef.current = events;

  useEffect(() => {
    // Register stable wrapper functions that delegate to the latest handler
    const wrappers = eventsRef.current.map(({ event }) => {
      const wrapper = (...args: unknown[]) => {
        const entry = eventsRef.current.find((e) => e.event === event);
        entry?.handler(...args);
      };
      socket.on(event, wrapper);
      return { event, wrapper };
    });

    return () => {
      wrappers.forEach(({ event, wrapper }) => {
        socket.off(event, wrapper);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
