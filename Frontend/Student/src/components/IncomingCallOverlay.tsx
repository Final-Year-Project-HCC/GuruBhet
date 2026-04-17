"use client";

import React from "react";
import { Phone } from "lucide-react";
import type { IncomingSession } from "@/hooks/useStudentSocket";

interface IncomingCallOverlayProps {
  session: IncomingSession;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallOverlay({
  session,
  onAccept,
  onReject,
}: IncomingCallOverlayProps) {
  return (
    <div
      id="incoming-call-overlay"
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
        {/* Pulsing ring indicator */}
        <div className="relative flex items-center justify-center">
          <span
            className="absolute w-20 h-20 rounded-full animate-ping opacity-20"
            style={{ backgroundColor: "var(--call-accept)" }}
          />
          <span
            className="absolute w-20 h-20 rounded-full animate-pulse opacity-30"
            style={{ backgroundColor: "var(--call-accept)" }}
          />
          <div
            className="relative w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--call-accept)" }}
          >
            <Phone size={28} color="#fff" />
          </div>
        </div>

        {/* Session info */}
        <div className="text-center">
          <p
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            Incoming Session
          </p>
          <h2
            className="text-xl font-bold mb-1"
            style={{ color: "var(--foreground)" }}
          >
            {session.teacherName}
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
          {/* Reject */}
          <button
            id="reject-session-btn"
            onClick={onReject}
            disabled={session.isResponding}
            className="group flex flex-col items-center gap-2 disabled:opacity-50"
            aria-label="Reject session"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{ backgroundColor: "var(--call-reject)" }}
            >
              <Phone
                size={26}
                color="#fff"
                style={{ transform: "rotate(135deg)" }}
              />
            </div>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--call-reject)" }}
            >
              Decline
            </span>
          </button>

          {/* Accept */}
          <button
            id="accept-session-btn"
            onClick={onAccept}
            disabled={session.isResponding}
            className="group flex flex-col items-center gap-2 disabled:opacity-50"
            aria-label="Accept session"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 call-accept-pulse"
              style={{ backgroundColor: "var(--call-accept)" }}
            >
              <Phone size={26} color="#fff" />
            </div>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--call-accept)" }}
            >
              Accept
            </span>
          </button>
        </div>

        {/* Loading state */}
        {session.isResponding && (
          <p
            className="text-xs font-medium animate-pulse"
            style={{ color: "var(--muted-foreground)" }}
          >
            Processing…
          </p>
        )}
      </div>
    </div>
  );
}
