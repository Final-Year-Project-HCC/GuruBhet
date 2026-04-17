"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useSocketEvents, SocketEventEntry } from "./useSocketEvents";
import { useUser } from "./useCurrentUser";

/* ── Payload types ─────────────────────────────────────────────────── */

interface SessionAcceptedPayload {
  bookingId: string;
  token: string;
  liveKitUrl: string;
}

export interface ActiveRoom {
  token: string;
  liveKitUrl: string;
}

/* ── Hook ──────────────────────────────────────────────────────────── */

export function useTeacherSocket() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();

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

  const handleBookingRequested = useCallback(
    (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["teacherBookings"] });
      const payload = data as { studentName?: string; subjectName?: string };
      toast.info(
        payload?.studentName
          ? `New booking request from ${payload.studentName} for "${payload.subjectName}"`
          : "You have a new booking request!"
      );
    },
    [queryClient]
  );

  const handleBookingPaid = useCallback(
    (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["teacherBookings"] });
      const payload = data as { studentName?: string };
      toast.success(
        payload?.studentName
          ? `Payment received from ${payload.studentName}!`
          : "A booking payment has been received!"
      );
    },
    [queryClient]
  );

  const handleSessionRequestAccepted = useCallback(
    (data: unknown) => {
      const payload = data as SessionAcceptedPayload;
      toast.info("Connecting to session...");
      setActiveRoom({
        token: payload.token,
        liveKitUrl: payload.liveKitUrl,
      });
    },
    []
  );

  const handleSessionRequestRejected = useCallback(
    (data: unknown) => {
      const payload = data as { reason?: string };
      toast.info(
        payload?.reason
          ? `Session request declined: ${payload.reason}`
          : "The session request was declined."
      );
    },
    []
  );

  /* ── Subscribe ─────────────────────────────────────────────────── */

  const events: SocketEventEntry[] = useMemo(
    () => [
      { event: "booking_requested", handler: handleBookingRequested },
      { event: "booking_paid", handler: handleBookingPaid },
      {
        event: "session_request_accepted",
        handler: handleSessionRequestAccepted,
      },
      {
        event: "session_request_rejected",
        handler: handleSessionRequestRejected,
      },
    ],
    [
      handleBookingRequested,
      handleBookingPaid,
      handleSessionRequestAccepted,
      handleSessionRequestRejected,
    ]
  );

  useSocketEvents(events);

  /* ── Actions ───────────────────────────────────────────────────── */

  const leaveRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  return { activeRoom, leaveRoom };
}
