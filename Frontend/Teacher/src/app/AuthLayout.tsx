"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import AuthGuard from "@/components/AuthGuard";
import TeacherNavbar from "@/components/TeacherNavbar";
import Footer from "@/components/Footer";
import { useTeacherSocket } from "@/hooks/useTeacherSocket";
import OutgoingCallOverlay from "@/components/OutgoingCallOverlay";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { TeacherRoomOverlay } from "./dashboard/TeacherRoomOverlay";
import socket from "@/lib/socket";

/** Routes accessible without logging in */
const PUBLIC_PATHS = ["/", "/dashboard", "/login", "/signup"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname);
  const { activeRoom, leaveRoom, outgoingSession, cancelOutgoingSession } = useTeacherSocket();

  // Teardown room when session_finished fires (matches current sessionId)
  useEffect(() => {
    const handleSessionFinished = (payload: { session_id: string }) => {
      if (activeRoom && payload.session_id === activeRoom.sessionId) {
        leaveRoom();
      }
    };
    socket.on("session_finished", handleSessionFinished);
    return () => { socket.off("session_finished", handleSessionFinished); };
  }, [activeRoom, leaveRoom]);

  return (
    <div className="min-h-screen flex flex-col">
      <TeacherNavbar />
      <main className="flex-1">
        {isPublic ? children : <AuthGuard>{children}</AuthGuard>}
      </main>
      <Footer />

      {/* LiveKit room overlay triggered by session_request_accepted */}
      {activeRoom && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
          <TeacherRoomOverlay
            sessionId={activeRoom.sessionId}
            actualStartAt={activeRoom.actualStartAt}
            durationMinutes={activeRoom.durationMinutes}
            leniencyMinutes={activeRoom.leniencyMinutes}
            onLeave={leaveRoom}
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
      )}

      {/* Outgoing call overlay */}
      {outgoingSession && (
        <OutgoingCallOverlay
          session={outgoingSession}
          onCancel={cancelOutgoingSession}
          onTimeout={cancelOutgoingSession}
        />
      )}
    </div>
  );
}
