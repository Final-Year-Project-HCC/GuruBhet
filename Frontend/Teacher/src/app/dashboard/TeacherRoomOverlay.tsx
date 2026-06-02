import { useEffect, useState } from "react";

interface RoomOverlayProps {
  actualStartAt: string;
  durationMinutes: number;
  leniencyMinutes: number;
}

export function TeacherRoomOverlay({
  actualStartAt,
  durationMinutes,
  leniencyMinutes,
}: RoomOverlayProps) {
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
