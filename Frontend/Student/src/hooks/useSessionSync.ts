/**
 * useSessionSync Hook
 *
 * Handles automatic session synchronization on Socket.IO reconnection or page refresh.
 * Implements the sync endpoint call with error handling for expired sessions.
 */

import { useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useBooking } from "@/contexts/BookingContext"; // Adjust based on your context
import { useToast } from "@/hooks/useToast";
import { useRouter } from "next/router";

export interface LiveKitToken {
  token: string;
  room_name: string;
  livekit_url: string;
}

interface SyncOptions {
  onSuccess?: (data: LiveKitToken) => void;
  onExpired?: () => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean; // Auto-sync on socket reconnect
}

export function useSessionSync(options: SyncOptions = {}) {
  const { onSuccess, onExpired, onError, autoReconnect = true } = options;

  const { socket, isConnected } = useSocket();
  const { currentBookingId } = useBooking();
  const { showToast } = useToast();
  const router = useRouter();
  const syncInProgressRef = useRef(false);

  /**
   * Call the /sync endpoint to get a fresh token.
   * Handles 403 (expired) and 410 (gone) errors gracefully.
   */
  const sync = useCallback(async () => {
    if (!currentBookingId) {
      console.debug("[useSessionSync] No booking ID in state");
      return;
    }

    if (syncInProgressRef.current) {
      console.debug("[useSessionSync] Sync already in progress");
      return;
    }

    syncInProgressRef.current = true;

    try {
      const response = await fetch(
        `/api/v1/bookings/${currentBookingId}/sync`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Auth token will be sent via httpOnly cookie or Authorization header
          },
          credentials: "include",
        },
      );

      if (response.status === 403) {
        // Session window + leniency has expired
        console.warn("[useSessionSync] Session expired (403)");
        showToast("Session window has expired", "warning");
        onExpired?.();
        router.push("/dashboard?reason=session_expired");
        return;
      }

      if (response.status === 410) {
        // Session not found or gone
        console.warn("[useSessionSync] Session gone (410)");
        showToast("Session no longer available", "error");
        onExpired?.();
        router.push("/dashboard?reason=session_gone");
        return;
      }

      if (!response.ok) {
        throw new Error(`Sync failed with status ${response.status}`);
      }

      const data: LiveKitToken = await response.json();

      console.info("[useSessionSync] Sync successful", {
        room_name: data.room_name,
      });

      // Re-initialize LiveKit component with fresh token
      // Note: Placeholder implementation - LiveKit not yet integrated
      console.debug(
        "[useSessionSync] Token refreshed for room:",
        data.room_name,
      );

      onSuccess?.(data);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      console.error("[useSessionSync] Sync failed:", err);
      onError?.(err);
      showToast("Failed to reconnect to session", "error");
    } finally {
      syncInProgressRef.current = false;
    }
  }, [currentBookingId, onSuccess, onExpired, onError, showToast, router]);

  /**
   * Auto-sync on socket reconnection
   */
  useEffect(() => {
    if (!socket || !autoReconnect || !isConnected) {
      return;
    }

    const handleConnect = () => {
      console.info("[useSessionSync] Socket connected, syncing session...");
      sync();
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, autoReconnect, isConnected, sync]);

  return { sync };
}
