"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import StudentNavbar from "@/components/StudentNavbar";
import Footer from "@/components/Footer";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import { useStudentSocket } from "@/hooks/useStudentSocket";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { StudentRoomOverlay, CountdownModal } from "./dashboard/StudentRoomOverlay";
import socket from "@/lib/socket";
import { RatingModal } from "@/components/Bookings";

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
  const { incomingSession, acceptSession, rejectSession, dismissSession, activeRoom, leaveRoom, pendingRatingBooking, dismissRatingModal } = useStudentSocket();
  const [requestedPrematureSessionId, setRequestedPrematureSessionId] = useState<string | null>(null);

  // Premature completion request from teacher (while in call-flow room)
  useEffect(() => {
    const handlePrematureRequest = (payload: { session_id: string }) => {
      setRequestedPrematureSessionId(payload.session_id);
    };
    socket.on("premature_session_completion_requested", handlePrematureRequest);
    return () => { socket.off("premature_session_completion_requested", handlePrematureRequest); };
  }, []);

  // Note: session_finished is now handled by useStudentSocket hook

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
          <StudentRoomOverlay
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

      {/* Incoming session call overlay */}
      {incomingSession && (
        <IncomingCallOverlay
          session={incomingSession}
          onAccept={acceptSession}
          onReject={rejectSession}
          onTimeout={dismissSession}
        />
      )}

      {/* Premature completion dialog (teacher-initiated while in call-flow room) */}
      {requestedPrematureSessionId && (
        <CountdownModal
          sessionId={requestedPrematureSessionId}
          onClose={() => setRequestedPrematureSessionId(null)}
        />
      )}

      {/* Rating modal triggered by booking_completed socket event */}
      {pendingRatingBooking && (
        <RatingModal
          booking={pendingRatingBooking}
          onClose={dismissRatingModal}
        />
      )}
    </div>
  );
}
