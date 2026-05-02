"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks";
import apiClient from "@/lib/api";
import socket from "@/lib/socket";
import { Booking, Session } from "@/lib/types";
import { BookOpen, Clock, CheckCircle, Layers } from "lucide-react";
import { toast } from "react-toastify";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import Link from "next/link";
import { StudentRoomOverlay, CountdownModal } from "./StudentRoomOverlay";

export default function StudentDashboard() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const [activeRoom, setActiveRoom] = useState<{
    token: string;
    liveKitUrl: string;
    sessionId: string;
    bookingId: string;
    actualStartAt: string;
    durationMinutes: number;
    leniencyMinutes: number;
  } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [requestedPrematureSessionId, setRequestedPrematureSessionId] = useState<string | null>(null);

  const firstName = user?.firstName ?? "Student";

  // Sockets for premature completion & teardown
  useEffect(() => {
    const handleSessionFinished = (payload: { session_id: string; status: string }) => {
      if (activeRoom && payload.session_id === activeRoom.sessionId) {
        setActiveRoom(null);
        toast.info("Session finished.");
        setRequestedPrematureSessionId(null);
        queryClient.invalidateQueries({ queryKey: ["sessions", "in-progress"] });
        queryClient.invalidateQueries({ queryKey: ["studentBookings"] });
      }
    };

    const handlePrematureRequest = (payload: { session_id: string; remaining_duration_seconds: number }) => {
      setRequestedPrematureSessionId(payload.session_id);
    };

    socket.on("session_finished", handleSessionFinished);
    socket.on("premature_session_completion_requested", handlePrematureRequest);

    return () => {
      socket.off("session_finished", handleSessionFinished);
      socket.off("premature_session_completion_requested", handlePrematureRequest);
    };
  }, [activeRoom, queryClient]);

  // Fetch bookings for stats
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["studentBookings"],
    queryFn: async () => {
      const { data } = await apiClient.get("/students/me/bookings");
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch in-progress sessions for "Ongoing Session" section
  const { data: ongoingSessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["sessions", "in-progress"],
    queryFn: async () => {
      const { data } = await apiClient.get("/students/me/sessions/in-progress");
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const handleJoinClassroom = async (bookingId: string) => {
    try {
      setIsJoining(true);
      const session = ongoingSessions.find((s) => s.booking.id === bookingId);
      const { data } = await apiClient.get(`/bookings/${bookingId}/sync`);
      setActiveRoom({
        token: data.token,
        liveKitUrl: data.livekit_url || data.liveKitUrl,
        sessionId: session?.id ?? data.room_name?.replace("session-", "") ?? "",
        bookingId,
        actualStartAt: data.actual_start_at || session?.actualStartAt || new Date().toISOString(),
        durationMinutes: data.session_duration_minutes ?? 60,
        leniencyMinutes: data.leniency_minutes ?? 5,
      });
    } catch {
      toast.error("Failed to join classroom. Please check if the room is ready.");
    } finally {
      setIsJoining(false);
    }
  };

  // Derived stats
  const activeBookings = bookings.filter((b) => b.status === "ACTIVE");
  const completedSessions = bookings.reduce((sum, b) => sum + b.completedSessions, 0);
  const totalSpent = bookings
    .filter((b) => b.status === "COMPLETED" || b.status === "ACTIVE")
    .reduce((sum, b) => sum + Number(b.totalAmount), 0);

  if (activeRoom) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
        <StudentRoomOverlay
          sessionId={activeRoom.sessionId}
          actualStartAt={activeRoom.actualStartAt}
          durationMinutes={activeRoom.durationMinutes}
          leniencyMinutes={activeRoom.leniencyMinutes}
          onLeave={() => setActiveRoom(null)}
        />
        <div className="flex-1 overflow-hidden">
          <LiveKitRoom
            video={true}
            audio={true}
            token={activeRoom.token}
            serverUrl={activeRoom.liveKitUrl || "wss://live.gurubhet.tech"}
            connect={true}
            data-lk-theme="default"
            style={{ height: "100%", width: "100%" }}
          >
            <VideoConference />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-1">
            Namaste, {firstName}!
          </h1>
          <p className="text-muted-foreground text-base">
            Here&apos;s an overview of your learning journey.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-background border border-border rounded-2xl p-6 shadow-sm">
            <div className="w-11 h-11 bg-muted rounded-xl flex items-center justify-center text-foreground mb-4">
              <Layers size={22} />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Total Bookings</p>
            <h3 className="text-2xl font-bold text-foreground">{bookings.length}</h3>
          </div>

          <div className="bg-background border border-border rounded-2xl p-6 shadow-sm">
            <div className="w-11 h-11 bg-muted rounded-xl flex items-center justify-center text-foreground mb-4">
              <BookOpen size={22} />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Active</p>
            <h3 className="text-2xl font-bold text-foreground">{activeBookings.length}</h3>
          </div>

          <div className="bg-background border border-border rounded-2xl p-6 shadow-sm">
            <div className="w-11 h-11 bg-muted rounded-xl flex items-center justify-center text-foreground mb-4">
              <CheckCircle size={22} />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Completed</p>
            <h3 className="text-2xl font-bold text-foreground">{completedSessions}</h3>
          </div>

          <div className="bg-background border border-border rounded-2xl p-6 shadow-sm">
            <div className="w-11 h-11 bg-muted rounded-xl flex items-center justify-center text-foreground mb-4">
              <Clock size={22} />
            </div>
            <p className="text-sm text-muted-foreground font-medium mb-1">Total Spent</p>
            <h3 className="text-2xl font-bold text-foreground">Rs {totalSpent.toLocaleString("en-IN")}</h3>
          </div>
        </div>

        {/* Ongoing Sessions */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Ongoing Session</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Sessions currently in progress</p>
            </div>
            <Link
              href="/sessions"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View All →
            </Link>
          </div>

          {sessionsLoading ? (
            <div className="border border-border rounded-2xl p-10 text-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground mx-auto" />
            </div>
          ) : ongoingSessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ongoingSessions.map((session) => {
                const progress = Math.round(
                  (session.sessionNumber / session.booking.totalSessions) * 100
                );
                const tName = `${session.booking.teacher.firstName} ${session.booking.teacher.lastName}`;

                return (
                  <div
                    key={`${session.booking.id}-${session.sessionNumber}`}
                    className="bg-background border border-border rounded-2xl p-6 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow"
                  >
                    {/* Live badge + time */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-widest text-destructive">
                          Live
                        </span>
                      </div>
                      {session.actualStartAt && (
                        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                          {new Date(session.actualStartAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    {/* Subject + teacher */}
                    <div>
                      <h3 className="font-bold text-lg text-foreground leading-tight mb-1">
                        {session.booking.subject.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {session.booking.teacher.avatarUrl ? (
                          <img
                            src={session.booking.teacher.avatarUrl}
                            className="w-7 h-7 rounded-full border border-border object-cover"
                            alt={tName}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
                            <span className="text-xs font-bold text-muted-foreground">
                              {session.booking.teacher.firstName.charAt(0)}
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-muted-foreground font-medium">
                          Taught by {tName}
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-auto">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Session {session.sessionNumber} of {session.booking.totalSessions}</span>
                        <span className="font-semibold text-foreground">{progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mb-4">
                        <div
                          style={{ width: `${progress}%` }}
                          className="bg-primary h-full rounded-full transition-all duration-700"
                        />
                      </div>
                      <button
                        onClick={() => handleJoinClassroom(session.booking.id)}
                        disabled={isJoining}
                        className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                      >
                        {isJoining ? "Joining..." : "Enter Classroom"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-2xl p-12 text-center">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
                <Clock size={22} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">No ongoing sessions</p>
              <p className="text-sm text-muted-foreground">
                When a session is in progress it will appear here.
              </p>
            </div>
          )}
        </section>

        {/* Recent Bookings */}
        {activeBookings.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Active Bookings</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Your confirmed tutoring sessions</p>
              </div>
              <Link
                href="/bookings"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="bg-background border border-border rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Subject</th>
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Teacher</th>
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Progress</th>
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeBookings.slice(0, 5).map((booking) => {
                    const progress = Math.round(
                      (booking.completedSessions / booking.totalSessions) * 100
                    );
                    const tName = `${booking.teacher?.firstName ?? ""} ${booking.teacher?.lastName ?? ""}`.trim();
                    return (
                      <tr key={booking.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-foreground text-sm">
                            {booking.subject?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-muted-foreground">{tName || "—"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                style={{ width: `${progress}%` }}
                                className="h-full bg-primary rounded-full"
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {booking.completedSessions}/{booking.totalSessions}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-foreground">
                            Rs {booking.ratePerSession}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Empty state / CTA when no bookings */}
        {bookings.length === 0 && !sessionsLoading && (
          <section className="mt-12">
            <div className="border border-dashed border-border rounded-2xl p-12 text-center">
              <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen size={26} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No bookings yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                Start your learning journey by finding a qualified tutor for your subject.
              </p>
              <Link
                href="/search-teacher"
                className="inline-flex items-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Find a Tutor
              </Link>
            </div>
          </section>
        )}
      </div>

      {requestedPrematureSessionId && (
        <CountdownModal
          sessionId={requestedPrematureSessionId}
          onClose={() => setRequestedPrematureSessionId(null)}
        />
      )}
    </div>
  );
}


