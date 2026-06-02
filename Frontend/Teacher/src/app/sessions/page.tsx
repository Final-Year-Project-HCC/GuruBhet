"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LiveKitRoom } from "@livekit/components-react";
import { Session } from "@/lib/types";
import PiPVideoLayout from "@/components/PiPVideoLayout";
import { useTeacherSocket } from "@/hooks/useTeacherSocket";
import { TeacherRoomOverlay } from "@/app/dashboard/TeacherRoomOverlay";
import { TeacherRoomActions } from "@/app/dashboard/TeacherRoomActions";
import apiClient from "@/lib/api";

const TeacherSessionsPage: React.FC = () => {
  const { activeRoom, leaveRoom, joinClassroomFromDashboard } = useTeacherSocket();
  const { data: inProgressSessions = [], isLoading: inProgressLoading } =
    useQuery<Session[]>({
      queryKey: ["sessions", "in-progress"],
      queryFn: async () => {
        const { data } = await apiClient.get("/teachers/me/sessions/in-progress");
        return data;
      },
    });

  const { data: completedSessions = [], isLoading: completedLoading } =
    useQuery<Session[]>({
      queryKey: ["sessions", "history"],
      queryFn: async () => {
        const { data } = await apiClient.get("/teachers/me/sessions/history");
        return data;
      },
    });

  const [isJoining, setIsJoining] = useState(false);

  const handleJoinClassroom = async (bookingId: string) => {
    const session = inProgressSessions.find((s) => s.booking.id === bookingId);
    setIsJoining(true);
    try {
      await joinClassroomFromDashboard(bookingId, session?.id ?? "");
    } finally {
      setIsJoining(false);
    }
  };

  const activeStats = {
    total: inProgressSessions.length,
    remaining: inProgressSessions.reduce(
      (acc, s) => acc + (s.booking.totalSessions - s.sessionNumber + 1),
      0
    ),
    liveCount: inProgressSessions.length,
  };

  const completedStats = {
    total: completedSessions.length,
    totalHours: completedSessions.length, // approximation
  };

  if (activeRoom) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
        <TeacherRoomOverlay
          actualStartAt={activeRoom.actualStartAt}
          durationMinutes={activeRoom.durationMinutes}
          leniencyMinutes={activeRoom.leniencyMinutes}
        />
        <div className="flex-1 overflow-hidden">
          <LiveKitRoom
            video={true}
            audio={true}
            token={activeRoom.token}
            serverUrl={activeRoom.liveKitUrl || "wss://live.gurubhet.tech"}
            connect={true}
            data-lk-theme="default"
            style={{ height: '100%', width: '100%' }}
          >
            <PiPVideoLayout extraControls={
              <TeacherRoomActions
                sessionId={activeRoom.sessionId}
                actualStartAt={activeRoom.actualStartAt}
                durationMinutes={activeRoom.durationMinutes}
                leniencyMinutes={activeRoom.leniencyMinutes}
                onLeave={leaveRoom}
              />
            } />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-muted min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4">
        {/* Page Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tight text-primary">
            My Teaching Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Track your progress and manage your 1-to-1 education journey.
          </p>
        </div>

        {/* Section 1: Active Sessions */}
        <div className="mb-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-primary">
                Active Teaching Tracks
              </h2>
              <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider mt-1">
                Ongoing Classes
              </p>
            </div>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-primary leading-none">
                  {activeStats.total}
                </p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">
                  Tracks
                </p>
              </div>
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-primary leading-none">
                  {activeStats.remaining}
                </p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">
                  To Go
                </p>
              </div>
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-success leading-none">
                  {activeStats.liveCount}
                </p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">
                  Live Now
                </p>
              </div>
            </div>
          </div>

          {inProgressLoading ? (
            <p className="text-muted-foreground">Loading active sessions...</p>
          ) : inProgressSessions.length === 0 ? (
            <p className="text-muted-foreground font-medium">
              No sessions are currently in progress.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {inProgressSessions.map((session) => {
                const progress = Math.round(
                  (session.sessionNumber / session.booking.totalSessions) * 100
                );
                const sName = `${session.booking.student.firstName} ${session.booking.student.lastName}`;

                return (
                  <div
                    key={`${session.booking.id}-${session.sessionNumber}`}
                    className="bg-surface rounded-[2.5rem] border border-border p-8 shadow-sm hover:shadow-xl transition-all group flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-destructive">
                          Session In Progress
                        </span>
                      </div>
                      {session.actualStartAt && (
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-3 py-1.5 rounded-xl uppercase">
                          Started: {new Date(session.actualStartAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    <div className="mb-6">
                      <h3 className="font-black text-2xl leading-tight mb-2 group-hover:text-primary transition-colors">
                        {session.booking.subject.name}
                      </h3>
                      <div className="flex items-center gap-3">
                        {session.booking.student.avatarUrl ? (
                          <img
                            src={session.booking.student.avatarUrl}
                            className="w-8 h-8 rounded-full border border-border shadow-sm object-cover"
                            alt={sName}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border">
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {session.booking.student.firstName.charAt(0)}
                            </span>
                          </div>
                        )}
                        <p className="text-sm font-bold text-muted-foreground">
                          Teaching {sName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                            Course Progress
                          </span>
                          <span className="text-lg font-black text-primary">
                            {session.sessionNumber}{" "}
                            <span className="text-muted-foreground text-sm font-bold">
                              / {session.booking.totalSessions} Sessions
                            </span>
                          </span>
                        </div>
                        <span className="text-lg font-black text-primary">
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full bg-subtle rounded-full h-2.5 overflow-hidden mb-8">
                        <div
                          style={{ width: `${progress}%` }}
                          className="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
                        />
                      </div>

                      <button
                        onClick={() => handleJoinClassroom(session.booking.id)}
                        disabled={isJoining}
                        className="w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-lg active:scale-95 bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        {isJoining ? "Joining..." : "Enter Classroom Now"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Completed Sessions */}
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-primary">
                Completed History
              </h2>
              <p className="text-sm text-muted-foreground font-bold uppercase tracking-wider mt-1">
                Review your past teaching achievements
              </p>
            </div>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-primary leading-none">
                  {completedStats.total}
                </p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">
                  Sessions
                </p>
              </div>
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center min-w-25">
                <p className="text-2xl font-black text-primary leading-none">
                  -
                </p>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mt-1">
                  Hours
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-subtle border-b border-border">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Course Subject
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Student
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Session No.
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Completed On
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {completedLoading ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-6 text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                          Loading history...
                        </p>
                      </td>
                    </tr>
                  ) : completedSessions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-6 text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                          No completed sessions found.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    completedSessions.map((session) => {
                      const sName = `${session.booking.student.firstName} ${session.booking.student.lastName}`;
                      return (
                        <tr
                          key={`${session.booking.id}-${session.sessionNumber}`}
                          className="hover:bg-subtle/50 transition-colors"
                        >
                          <td className="px-8 py-6">
                            <div>
                              <p className="font-black text-primary">
                                {session.booking.subject.name}
                              </p>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              {session.booking.student.avatarUrl ? (
                                <img
                                  src={session.booking.student.avatarUrl}
                                  className="w-6 h-6 rounded-full border border-border object-cover"
                                  alt={sName}
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border border-border">
                                  <span className="text-[8px] font-bold text-muted-foreground">
                                    {session.booking.student.firstName.charAt(0)}
                                  </span>
                                </div>
                              )}
                              <span className="text-sm font-bold text-muted-foreground">
                                {sName}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-sm font-black text-primary">
                              Session {session.sessionNumber}
                            </span>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                              of {session.booking.totalSessions} total
                            </p>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-sm font-bold text-muted-foreground">
                              {session.actualStartAt
                                ? new Date(session.actualStartAt).toLocaleDateString()
                                : "N/A"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSessionsPage;
