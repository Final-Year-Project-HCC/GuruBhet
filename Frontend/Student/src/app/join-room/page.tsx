"use client";

import { useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

export default function JoinRoomPage() {
  const [token, setToken] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState("");

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token.trim()) {
      setError("Please paste a valid token");
      return;
    }

    try {
      setIsJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
      setIsJoined(false);
    }
  }

  if (isJoined) {
  return (
    /* Full screen overlay on top of everything */
    <div className="fixed inset-0 z-9999 flex flex-col bg-black">
      {/* Leave button */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setIsJoined(false)}
          className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
        >
          Leave Room
        </button>
      </div>

      {/* LiveKit Room - takes full screen */}
      <div className="flex-1 overflow-hidden">
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl="wss://live.gurubhet.tech"
          connect={true}
          data-lk-theme="default"
          style={{ height: '100%', width: '100%' }}
        >
          <VideoConference />
        </LiveKitRoom>
      </div>
    </div>
  );
}

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Join Room</h1>

        <form onSubmit={handleJoinRoom} className="space-y-4">
          {/* Token Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              LiveKit Token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your LiveKit token here..."
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Join Button */}
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Join Room
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Connected to: <span className="font-mono">live.gurubhet.tech</span>
        </p>
      </div>
    </div>
  );
}
