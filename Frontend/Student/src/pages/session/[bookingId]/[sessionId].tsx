/**
 * Session Page
 *
 * NOTE: LiveKit integration has been removed.
 * This page is a placeholder for future video session implementation.
 */

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function SessionPage() {
  const router = useRouter();
  const { bookingId, sessionId } = router.query as {
    bookingId?: string;
    sessionId?: string;
  };

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || !sessionId) {
      return;
    }
    setIsLoading(false);
  }, [bookingId, sessionId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading session...</p>
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

  return (
    <div className="flex items-center justify-center w-full h-screen bg-gray-900">
      <div className="text-white text-center max-w-md">
        <h1 className="text-3xl font-bold mb-4">Session Placeholder</h1>
        <p className="text-gray-300 mb-6">
          Video session functionality has been removed. This page is a
          placeholder for future implementation.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Booking ID: {bookingId} | Session ID: {sessionId}
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
