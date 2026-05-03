"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useSocketEvents, SocketEventEntry } from "./useSocketEvents";
import { useUser } from "./useCurrentUser";
import apiClient from "@/lib/api";
import type { Booking } from "@/lib/types";

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
  sessionId: string;
  bookingId: string;
  actualStartAt: string;
  durationMinutes: number;
  leniencyMinutes: number;
}

export interface PendingRatingBooking {
  bookingId: string;
  teacherName: string;
  subjectName: string;
  totalSessions: number;
  completedSessions: number;
}

/* ── Hook ──────────────────────────────────────────────────────────── */

export function useStudentSocket() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();

  const [incomingSession, setIncomingSession] =
    useState<IncomingSession | null>(null);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [pendingRatingBooking, setPendingRatingBooking] =
    useState<PendingRatingBooking | null>(null);

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

  const handleSessionFinished = useCallback(
    (data: unknown) => {
      const payload = data as { session_id: string; status: string };
      if (activeRoom && payload.session_id === activeRoom.sessionId) {
        setActiveRoom(null);
        toast.info("Session finished.");
        queryClient.invalidateQueries({ queryKey: ["sessions", "in-progress"] });
        queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
      }
    },
    [activeRoom, queryClient]
  );

  const handleBookingCompleted = useCallback(
    (data: unknown) => {
      const payload = data as { bookingId: string; teacherId: string };

      // Try to enrich the context from the React Query cache before invalidating
      const cachedBookings = queryClient.getQueryData<Booking[]>(["studentBookings"]);
      const booking = cachedBookings?.find((b) => b.id === payload.bookingId);

      const teacherName = booking?.teacher
        ? `${booking.teacher.firstName} ${booking.teacher.lastName}`
        : "Your Teacher";
      const subjectName = booking?.subject?.name || "Completed Subject";
      const totalSessions = booking?.totalSessions ?? 1;
      const completedSessions = booking?.completedSessions ?? 1;

      queryClient.invalidateQueries({ queryKey: ["studentBookings"] });

      setPendingRatingBooking({
        bookingId: payload.bookingId,
        teacherName,
        subjectName,
        totalSessions,
        completedSessions,
      });
    },
    [queryClient]
  );

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
      { event: "session_finished", handler: handleSessionFinished },
      { event: "booking_completed", handler: handleBookingCompleted },
    ],
    [
      handleBookingAccepted,
      handleBookingRejected,
      handleSessionRequested,
      handleSessionRequestCancelled,
      handleSessionFinished,
      handleBookingCompleted,
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
        liveKitUrl: data.livekit_url || data.liveKitUrl,
        sessionId: data.room_name?.replace("session-", "") ?? "",
        bookingId: incomingSession.bookingId,
        actualStartAt: data.actual_start_at || new Date().toISOString(),
        durationMinutes: data.session_duration_minutes ?? 60,
        leniencyMinutes: data.leniency_minutes ?? 5,
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
    queryClient.invalidateQueries({ queryKey: ["sessions", "in-progress"] });
    queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
  }, [queryClient]);

  const joinClassroomFromDashboard = useCallback(
    async (bookingId: string, sessionId: string) => {
      try {
        const { data } = await apiClient.get(`/bookings/${bookingId}/sync`);
        setActiveRoom({
          token: data.token,
          liveKitUrl: data.livekit_url || data.liveKitUrl,
          sessionId: sessionId ?? data.room_name?.replace("session-", "") ?? "",
          bookingId,
          actualStartAt: data.actual_start_at || new Date().toISOString(),
          durationMinutes: data.session_duration_minutes ?? 60,
          leniencyMinutes: data.leniency_minutes ?? 5,
        });
        return true;
      } catch {
        toast.error("Failed to join classroom. Please check if the room is ready.");
        return false;
      }
    },
    []
  );

  return {
    incomingSession,
    acceptSession,
    rejectSession,
    dismissSession,
    activeRoom,
    leaveRoom,
    joinClassroomFromDashboard,
    pendingRatingBooking,
    dismissRatingModal: () => setPendingRatingBooking(null),
  };
}
