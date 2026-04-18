"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import StudentNavbar from "@/components/StudentNavbar";
import Footer from "@/components/Footer";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import { useStudentSocket } from "@/hooks/useStudentSocket";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

/** Routes accessible without logging in */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/search-teacher"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/teacher-profile")
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname);
  const { incomingSession, acceptSession, rejectSession, dismissSession, activeRoom, leaveRoom } = useStudentSocket();

  return (
    <div className="min-h-screen flex flex-col">
      <StudentNavbar />
      <main className="flex-1">
        {isPublic ? children : <AuthGuard>{children}</AuthGuard>}
      </main>
      <Footer />

      {/* LiveKit room overlay triggered by acceptSession */}
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

      {/* Incoming session call overlay */}
      {incomingSession && (
        <IncomingCallOverlay
          session={incomingSession}
          onAccept={acceptSession}
          onReject={rejectSession}
          onTimeout={dismissSession}
        />
      )}
    </div>
  );
}
