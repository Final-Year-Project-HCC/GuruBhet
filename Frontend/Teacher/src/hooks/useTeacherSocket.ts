"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useSocketEvents, SocketEventEntry } from "./useSocketEvents";
import { useUser } from "./useCurrentUser";
import apiClient from "@/lib/api";

/* ── Payload types ─────────────────────────────────────────────────── */

interface SessionAcceptedPayload {
  bookingId: string;
  sessionId: string;
  token: string;
  roomName: string;
  liveKitUrl: string;
  actualStartAt: string | null;
  sessionDurationMinutes: number;
  leniencyMinutes: number;
}

export interface OutgoingSession {
  bookingId: string;
  studentName: string;
  subjectName: string;
  isCancelling: boolean;
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

/* ── Hook ──────────────────────────────────────────────────────────── */

export function useTeacherSocket() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();

  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [outgoingSession, setOutgoingSession] = useState<OutgoingSession | null>(null);

  /* ── Connect / disconnect based on auth ────────────────────────── */

  useEffect(() => {
    if (user) {
      connectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [user]);

  /* ── Outgoing Session Event Listener ──────────────────────────────── */

  useEffect(() => {
    const handleStart = (e: CustomEvent<OutgoingSession>) => {
      setOutgoingSession(e.detail);
    };
    window.addEventListener("startOutgoingSession", handleStart as EventListener);
    return () => {
      window.removeEventListener("startOutgoingSession", handleStart as EventListener);
    };
  }, []);

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
      setOutgoingSession(null);
      toast.info("Connecting to session...");
      setActiveRoom({
        token: payload.token,
        liveKitUrl: payload.liveKitUrl,
        sessionId: payload.sessionId ?? payload.roomName?.replace("session-", "") ?? "",
        bookingId: payload.bookingId,
        actualStartAt: payload.actualStartAt || new Date().toISOString(),
        durationMinutes: payload.sessionDurationMinutes ?? 60,
        leniencyMinutes: payload.leniencyMinutes ?? 5,
      });
    },
    []
  );

  const handleSessionRequestRejected = useCallback(
    (data: unknown) => {
      const payload = data as { reason?: string };
      setOutgoingSession(null);
      toast.info(
        payload?.reason
          ? `Session request declined: ${payload.reason}`
          : "The session request was declined."
      );
    },
    []
  );

  const handleSessionFinished = useCallback(
    (data: unknown) => {
      const payload = data as { session_id: string; status: string };
      if (activeRoom && payload.session_id === activeRoom.sessionId) {
        setActiveRoom(null);
        toast.info("Session finished.");
        queryClient.invalidateQueries({ queryKey: ["sessions", "in-progress"] });
        queryClient.invalidateQueries({ queryKey: ["teacherBookings"] });
      }
    },
    [activeRoom, queryClient]
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
      { event: "session_finished", handler: handleSessionFinished },
    ],
    [
      handleBookingRequested,
      handleBookingPaid,
      handleSessionRequestAccepted,
      handleSessionRequestRejected,
      handleSessionFinished,
    ]
  );

  useSocketEvents(events);

  /* ── Actions ───────────────────────────────────────────────────── */

  const startOutgoingSession = useCallback(
    (bookingId: string, studentName: string, subjectName: string) => {
      setOutgoingSession({
        bookingId,
        studentName,
        subjectName,
        isCancelling: false,
      });
    },
    []
  );

  const cancelOutgoingSession = useCallback(async () => {
    if (!outgoingSession) return;
    setOutgoingSession((prev) =>
      prev ? { ...prev, isCancelling: true } : null
    );
    try {
      await apiClient.post(
        `/bookings/${outgoingSession.bookingId}/session-cancel`
      );
      toast.info("Session request cancelled.");
    } catch {
      toast.error("Failed to cancel session request.");
    } finally {
      setOutgoingSession(null);
    }
  }, [outgoingSession]);

  const leaveRoom = useCallback(() => {
    setActiveRoom(null);
    queryClient.invalidateQueries({ queryKey: ["sessions", "in-progress"] });
    queryClient.invalidateQueries({ queryKey: ["teacherBookings"] });
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
    activeRoom,
    leaveRoom,
    outgoingSession,
    startOutgoingSession,
    cancelOutgoingSession,
    joinClassroomFromDashboard,
  };
}
