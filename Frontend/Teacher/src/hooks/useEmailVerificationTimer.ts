import { useState, useEffect, useCallback, useMemo } from "react";

export const useEmailVerificationTimer = (
  initialSeconds: number = 90, 
  enabled: boolean = false
) => {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds);

  // Derive isExpired to avoid extra state synchronization
  const isExpired = timeRemaining <= 0;

  useEffect(() => {
    // If not enabled or already expired, do nothing
    if (!enabled || isExpired) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isExpired, enabled]);

  // stable function to format time as MM:SS
  const formattedTime = useMemo(() => {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [timeRemaining]);

  // reset function to restart the countdown
  const resetTimer = useCallback(() => {
    setTimeRemaining(initialSeconds);
  }, [initialSeconds]);

  return {
    timeRemaining,
    isExpired,
    formattedTime,
    resetTimer,
  };
};