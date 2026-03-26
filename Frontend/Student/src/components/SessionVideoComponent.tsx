/**
 * SessionVideoComponent
 *
 * LiveKit video session wrapper with automatic reconnection and sync.
 * Handles:
 * - Initial token from /accept endpoint
 * - Socket.IO reconnection with automatic /sync calls
 * - Token refresh
 * - Expired session handling
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { useSessionSync, LiveKitToken } from "@/hooks/useSessionSync";
import { useBooking } from "@/contexts/BookingContext";
import { useToast } from "@/hooks/useToast";

interface SessionVideoComponentProps {
  bookingId: string;
  sessionId: string;
  initialToken: string;
  initialRoomName: string;
  liveKitUrl: string;
}

export function SessionVideoComponent({
  bookingId,
  sessionId,
  initialToken,
  initialRoomName,
  liveKitUrl,
}: SessionVideoComponentProps) {
  const { showToast } = useToast();
  const [token, setToken] = useState<string>(initialToken);
  const [roomName, setRoomName] = useState<string>(initialRoomName);
  const [isReady, setIsReady] = useState(false);
  const liveKitRoomRef = useRef<any>(null);

  /**
   * Handle sync endpoint response.
   * Re-initialize LiveKit room if token changed.
   */
  const handleSyncSuccess = useCallback(
    (data: LiveKitToken) => {
      console.info("[SessionVideoComponent] Sync successful, updating token");
      setToken(data.token);
      setRoomName(data.room_name);

      // Force LiveKit component to reinitialize
      // (Next.js/React will re-render due to state change)
      setIsReady(false);
      setTimeout(() => setIsReady(true), 100);

      showToast("Reconnected to session", "success");
    },
    [showToast],
  );

  /**
   * Handle session expiration.
   */
  const handleSessionExpired = useCallback(() => {
    console.warn("[SessionVideoComponent] Session expired");
    setIsReady(false);
  }, []);

  const { sync } = useSessionSync({
    onSuccess: handleSyncSuccess,
    onExpired: handleSessionExpired,
    autoReconnect: true,
  });

  /**
   * Manual sync trigger for testing or user-initiated reconnect
   */
  const handleManualSync = useCallback(async () => {
    showToast("Reconnecting...", "info");
    await sync();
  }, [sync, showToast]);

  useEffect(() => {
    // Room is ready to connect
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          <p className="mt-4">Connecting to session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Reconnect button (visible in top-right) */}
      <button
        onClick={handleManualSync}
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        title="Manually sync and reconnect to session"
      >
        🔄 Reconnect
      </button>

      {/* LiveKit Video Conference */}
      <LiveKitRoom
        ref={liveKitRoomRef}
        video={true}
        audio={true}
        token={token}
        connect={true}
        serverUrl={liveKitUrl}
        roomName={roomName}
        onError={(error) => {
          console.error("[SessionVideoComponent] LiveKit error:", error);
          showToast(`Connection error: ${error.message}`, "error");
        }}
        onConnected={() => {
          console.info("[SessionVideoComponent] Connected to LiveKit");
          showToast("Connected to session", "success");
        }}
        onDisconnected={() => {
          console.warn("[SessionVideoComponent] Disconnected from LiveKit");
        }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
