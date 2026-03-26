/**
 * Example: Session Page
 *
 * Shows how to:
 * 1. Call /accept endpoint to get initial token
 * 2. Render SessionVideoComponent with token
 * 3. Handle Socket.IO reconnection via useSessionSync
 * 4. Handle errors (410 Gone, 403 Forbidden)
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { SessionVideoComponent } from "@/components/SessionVideoComponent";
import { useToast } from "@/hooks/useToast";

interface SessionInitData {
  token: string;
  room_name: string;
  livekit_url: string;
}

export default function SessionPage() {
  const router = useRouter();
  const { bookingId, sessionId } = router.query as {
    bookingId?: string;
    sessionId?: string;
  };

  const { showToast } = useToast();
  const [sessionData, setSessionData] = useState<SessionInitData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Step 1: Accept session and get initial token
   * Called once on mount if student hasn't accepted yet
   */
  const acceptSession = async () => {
    if (!bookingId || !sessionId) {
      setError("Missing booking or session ID");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/bookings/${bookingId}/sessions/${sessionId}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        },
      );

      if (response.status === 410) {
        // Session acceptance window expired
        const errorMsg =
          "Session acceptance window expired. Please ask teacher to start again.";
        setError(errorMsg);
        showToast(errorMsg, "error");
        return;
      }

      if (response.status === 400) {
        // Session already accepted or other client error
        const data = await response.json();
        console.info(
          "[SessionPage] Session already accepted or invalid state:",
          data,
        );
        // Try to get token directly instead
        await getSessionToken();
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to accept session: ${response.statusText}`);
      }

      const data: SessionInitData = await response.json();
      setSessionData(data);
      showToast("Session accepted! Connecting...", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to accept session";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Alternative: Get token without accepting
   * Used if session is already accepted (SCHEDULED status)
   */
  const getSessionToken = async () => {
    if (!bookingId || !sessionId) {
      setError("Missing booking or session ID");
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/bookings/${bookingId}/sessions/${sessionId}/livekit-token`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.statusText}`);
      }

      const data: SessionInitData = await response.json();
      setSessionData(data);
      showToast("Connected to session", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get token";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * On mount: Try to accept session first, then get token
   */
  useEffect(() => {
    if (!bookingId || !sessionId) {
      return;
    }

    // Try to accept first (works if student hasn't accepted yet)
    acceptSession();
  }, [bookingId, sessionId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Initializing session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="bg-red-900 p-8 rounded-lg text-white text-center max-w-md">
          <h1 className="text-xl font-bold mb-4">Session Error</h1>
          <p className="mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white text-center">
          <p>No session data available</p>
        </div>
      </div>
    );
  }

  // Render video component with sync support
  return (
    <SessionVideoComponent
      bookingId={bookingId!}
      sessionId={sessionId!}
      initialToken={sessionData.token}
      initialRoomName={sessionData.room_name}
      liveKitUrl={sessionData.livekit_url}
    />
  );
}
