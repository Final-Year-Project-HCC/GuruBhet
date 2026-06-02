import React, { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import { Clock } from "lucide-react";

interface StudentRoomOverlayProps {
  actualStartAt: string;
  durationMinutes: number;
  leniencyMinutes: number;
}

export function StudentRoomOverlay({
  actualStartAt,
  durationMinutes,
  leniencyMinutes,
}: StudentRoomOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const start = new Date(actualStartAt).getTime();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [actualStartAt]);

  const durationSec = durationMinutes * 60;
  const leniencySec = leniencyMinutes * 60;
  const totalSec = durationSec + leniencySec;

  const isLeniencyPhase = elapsedSeconds >= durationSec && elapsedSeconds <= totalSec;
  const isExpired = elapsedSeconds > totalSec;

  let timerText = "";
  let isRed = false;

  if (isExpired) {
    timerText = "Ending...";
    isRed = true;
  } else if (isLeniencyPhase) {
    const left = totalSec - elapsedSeconds;
    const m = Math.floor(left / 60).toString().padStart(2, "0");
    const s = (left % 60).toString().padStart(2, "0");
    timerText = `${m}:${s}`;
    isRed = true;
  } else {
    const left = durationSec - elapsedSeconds;
    const m = Math.floor(left / 60).toString().padStart(2, "0");
    const s = (left % 60).toString().padStart(2, "0");
    timerText = `${m}:${s}`;
    isRed = false;
  }

  return (
    <div className="absolute top-4 left-4 z-50 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-xl flex items-center gap-3">
      <div className={`font-mono text-lg font-bold tracking-wider ${isRed ? "text-destructive animate-pulse" : ""}`}>
        {timerText}
      </div>
    </div>
  );
}

/* ── CountdownModal ─────────────────────────────────────────────────── */

export function CountdownModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 text-center">
      <div className="bg-background border border-border p-6 rounded-2xl max-w-sm w-full shadow-2xl relative">
        <div className="absolute -top-3 -right-3 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center font-bold shadow-lg animate-pulse">
          {timeLeft}
        </div>
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="text-primary w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">Teacher Requested Early Completion</h3>
        <p className="text-muted-foreground text-sm mb-6">
          Your teacher wishes to end the session early. Do you agree?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={async () => {
              onClose();
              try {
                await apiClient.post(`/sessions/${sessionId}/accept-premature-session-completion`);
              } catch {
                toast.error("Action failed");
              }
            }}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Yes, Complete Now
          </button>
          <button
            onClick={async () => {
              onClose();
              try {
                await apiClient.post(`/sessions/${sessionId}/reject-premature-session-completion`);
              } catch {
                toast.error("Action failed");
              }
            }}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
          >
            No, Keep Session Open
          </button>
        </div>
      </div>
    </div>
  );
}
