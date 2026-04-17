"use client";

import React, { useEffect, useRef } from "react";
import { PhoneOff } from "lucide-react";
import type { OutgoingSession } from "@/hooks/useTeacherSocket";

const TIMEOUT_SECONDS = 55;

interface OutgoingCallOverlayProps {
  session: OutgoingSession;
  onCancel: () => void;
  onTimeout: () => void;
}

export default function OutgoingCallOverlay({
  session,
  onCancel,
  onTimeout,
}: OutgoingCallOverlayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ── Ringtone ─────────────────────────────────────────────────────── */

  useEffect(() => {
    const audio = new Audio("/sounds/callerSideRingtone.mp4");
    audio.loop = true;
    audioRef.current = audio;

    audio.play().catch((err) => {
      console.warn("[OutgoingCallOverlay] Audio play blocked:", err);
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  /* ── 55-second auto-close timer ───────────────────────────────── */

  useEffect(() => {
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 1;
      console.log(
        `[OutgoingCallOverlay] Auto-close timer: ${elapsed}s / ${TIMEOUT_SECONDS}s`
      );

      if (elapsed >= TIMEOUT_SECONDS) {
        clearInterval(interval);
        onTimeout();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [onTimeout]);

  return (
    <div
      id="outgoing-call-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="flex flex-col items-center gap-8 p-10 rounded-3xl max-w-sm w-full mx-4"
        style={{
          backgroundColor: "var(--surface, var(--background))",
          border: "1px solid var(--border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Pulsing ring indicator (simulating outgoing ping) */}
        <div className="relative flex items-center justify-center">
          <span
            className="absolute w-20 h-20 rounded-full animate-ping opacity-20"
            style={{ backgroundColor: "var(--foreground)" }}
          />
          <span
            className="absolute w-20 h-20 rounded-full animate-pulse opacity-30"
            style={{ backgroundColor: "var(--foreground)" }}
          />
          <div
             className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-border"
             style={{ backgroundColor: "var(--muted)", overflow: "hidden" }}
           >
             <span className="text-xl font-bold" style={{ color: "var(--muted-foreground)" }}>
               {session.studentName.charAt(0)}
             </span>
          </div>
        </div>

        {/* Session info */}
        <div className="text-center">
          <p
            className="text-xs font-bold uppercase tracking-widest mb-2 animate-pulse"
            style={{ color: "var(--muted-foreground)" }}
          >
            Calling Student...
          </p>
          <h2
            className="text-xl font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {session.studentName}
          </h2>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            {session.subjectName}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-8">
          {/* Cancel */}
          <button
            id="cancel-call-btn"
            onClick={onCancel}
            disabled={session.isCancelling}
            className="group flex flex-col items-center gap-2 disabled:opacity-50"
            aria-label="Cancel session request"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{ backgroundColor: "var(--call-reject)" }}
            >
              <PhoneOff size={26} color="#fff" />
            </div>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--call-reject)" }}
            >
              Cancel
            </span>
          </button>
        </div>

        {/* Loading state */}
        {session.isCancelling && (
          <p
            className="text-xs font-medium animate-pulse"
            style={{ color: "var(--muted-foreground)" }}
          >
            Cancelling…
          </p>
        )}
      </div>
    </div>
  );
}
