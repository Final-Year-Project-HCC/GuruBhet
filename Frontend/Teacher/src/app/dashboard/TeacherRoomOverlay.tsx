import React, { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { toast } from "react-toastify";
import socket from "@/lib/socket";

interface RoomOverlayProps {
  sessionId: string;
  actualStartAt: string;
  durationMinutes: number;
  leniencyMinutes: number;
  onLeave: () => void;
}

export function TeacherRoomOverlay({
  sessionId,
  actualStartAt,
  durationMinutes,
  leniencyMinutes,
  onLeave,
}: RoomOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  const confirmCancel = async () => {
    setIsCancelling(true);
    try {
      await apiClient.post(`/sessions/${sessionId}/cancel`);
      toast.success("Session cancelled.");
      onLeave();
    } catch {
      toast.error("Failed to cancel session.");
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const handleComplete = async () => {
    setIsPending(true);
    try {
      await apiClient.post(`/sessions/${sessionId}/request-session-completion`);
      if (elapsedSeconds >= durationSec) {
        // Backend auto-completes
        toast.success("Session completed.");
        onLeave();
      } else {
        toast.info("Sent request to student. Waiting for approval...");
      }
    } catch {
      toast.error("Failed to request completion.");
      setIsPending(false);
    }
  };

  useEffect(() => {
    const handleAccepted = () => {
      toast.success("Student accepted early completion.");
      onLeave();
    };

    const handleRejected = () => {
      toast.error("Student rejected early completion.");
      setIsPending(false);
    };

    socket.on("premature_session_completion_accepted", handleAccepted);
    socket.on("premature_session_completion_rejected", handleRejected);

    return () => {
      socket.off("premature_session_completion_accepted", handleAccepted);
      socket.off("premature_session_completion_rejected", handleRejected);
    };
  }, [onLeave]);

  return (
    <>
      <div className="absolute top-4 left-4 z-50 bg-black/60 backdrop-blur text-white px-4 py-2 rounded-xl flex items-center gap-3">
        <div className={`font-mono text-lg font-bold tracking-wider ${isRed ? "text-destructive animate-pulse" : ""}`}>
          {timerText}
        </div>
      </div>

      <div className="absolute top-4 right-4 z-50 flex gap-3">
        {!isLeniencyPhase && !isExpired && (
          <button
            onClick={handleCancelClick}
            disabled={isPending || isCancelling}
            className="rounded-md bg-muted/20 hover:bg-muted/40 backdrop-blur px-4 py-2 text-white transition-colors text-sm font-medium"
          >
            Cancel Session
          </button>
        )}
        <button
          onClick={handleComplete}
          disabled={isPending || isCancelling || isExpired}
          className="rounded-md bg-primary px-5 py-2 text-primary-foreground hover:opacity-90 transition-colors text-sm font-bold shadow-lg disabled:opacity-50"
        >
          {isPending ? "Waiting..." : "Complete"}
        </button>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-2">Cancel Session?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Are you sure you want to cancel? The amount will be refunded to the student, and this action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50"
              >
                Go Back
              </button>
              <button
                onClick={confirmCancel}
                disabled={isCancelling}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-destructive text-destructive-foreground hover:opacity-90"
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
