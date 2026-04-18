"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useSocketEvents, SocketEventEntry } from "./useSocketEvents";
import { useUser } from "./useCurrentUser";
import apiClient from "@/lib/api";

/* ── Payload types ─────────────────────────────────────────────────── */

export interface IncomingSessionPayload {
  bookingId: string;
  teacherName: string;
  subjectName: string;
}

export interface IncomingSession extends IncomingSessionPayload {
  /** Whether an accept/reject request is in-flight */
  isResponding: boolean;
}

export interface ActiveRoom {
  token: string;
  liveKitUrl: string;
}

/* ── Hook ──────────────────────────────────────────────────────────── */

export function useStudentSocket() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();

  const [incomingSession, setIncomingSession] =
    useState<IncomingSession | null>(null);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);

  /* ── Connect / disconnect based on auth ────────────────────────── */

  useEffect(() => {
    if (user) {
      connectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [user]);

  /* ── Event handlers (stable refs via useCallback) ──────────────── */

  const handleBookingAccepted = useCallback(
    (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
      const payload = data as { subjectName?: string };
      toast.success(
        payload?.subjectName
          ? `Booking for "${payload.subjectName}" accepted!`
          : "Your booking has been accepted!"
      );
    },
    [queryClient]
  );

  const handleBookingRejected = useCallback(
    (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
      const payload = data as { reason?: string };
      toast.error(
        payload?.reason
          ? `Booking rejected: ${payload.reason}`
          : "Your booking has been rejected."
      );
    },
    [queryClient]
  );

  const handleSessionRequested = useCallback(
    (data: unknown) => {
      const payload = data as IncomingSessionPayload;
      setIncomingSession({ ...payload, isResponding: false });
    },
    []
  );

  const handleSessionRequestCancelled = useCallback(() => {
    setIncomingSession(null);
    toast.info("Session request was cancelled.");
  }, []);

  /* ── Subscribe ─────────────────────────────────────────────────── */

  const events: SocketEventEntry[] = useMemo(
    () => [
      { event: "booking_accepted", handler: handleBookingAccepted },
      { event: "booking_rejected", handler: handleBookingRejected },
      { event: "session_requested", handler: handleSessionRequested },
      {
        event: "session_request_cancelled",
        handler: handleSessionRequestCancelled,
      },
    ],
    [
      handleBookingAccepted,
      handleBookingRejected,
      handleSessionRequested,
      handleSessionRequestCancelled,
    ]
  );

  useSocketEvents(events);

  /* ── Actions ───────────────────────────────────────────────────── */

  const acceptSession = useCallback(async () => {
    if (!incomingSession) return;
    setIncomingSession((prev) =>
      prev ? { ...prev, isResponding: true } : null
    );
    try {
      const { data } = await apiClient.post(
        `/bookings/${incomingSession.bookingId}/accept-session`
      );
      toast.success("Session accepted! Connecting...");
      setActiveRoom({
        token: data.token,
        liveKitUrl: data.livekitUrl || data.liveKitUrl, // handle case variation
      });
    } catch {
      toast.error("Failed to accept session. Please try again.");
    } finally {
      setIncomingSession(null);
    }
  }, [incomingSession]);

  const rejectSession = useCallback(async () => {
    if (!incomingSession) return;
    setIncomingSession((prev) =>
      prev ? { ...prev, isResponding: true } : null
    );
    try {
      await apiClient.post(
        `/bookings/${incomingSession.bookingId}/reject-session`
      );
      toast.info("Session rejected.");
    } catch {
      toast.error("Failed to reject session.");
    } finally {
      setIncomingSession(null);
    }
  }, [incomingSession]);

  const dismissSession = useCallback(() => {
    setIncomingSession(null);
  }, []);

  const leaveRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  return { incomingSession, acceptSession, rejectSession, dismissSession, activeRoom, leaveRoom };
}
