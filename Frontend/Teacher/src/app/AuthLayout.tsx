"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import TeacherNavbar from "@/components/TeacherNavbar";
import Footer from "@/components/Footer";
import { useTeacherSocket } from "@/hooks/useTeacherSocket";
import OutgoingCallOverlay from "@/components/OutgoingCallOverlay";
import { LiveKitRoom } from "@livekit/components-react";
import { TeacherRoomOverlay } from "./dashboard/TeacherRoomOverlay";
import { TeacherRoomActions } from "./dashboard/TeacherRoomActions";
import PiPVideoLayout from "@/components/PiPVideoLayout";

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
              style={{ height: "100%", width: "100%" }}
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
