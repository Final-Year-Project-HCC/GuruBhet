"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TeacherNavbar from "@/components/TeacherNavbar";
import Footer from "@/components/Footer";
import { useTeacherSocket } from "@/hooks/useTeacherSocket";
import OutgoingCallOverlay from "@/components/OutgoingCallOverlay";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

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
          <div className="absolute top-4 right-4 z-50">
            <button
              onClick={leaveRoom}
              className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground hover:opacity-90 transition-colors"
            >
              Leave Room
            </button>
          </div>
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
