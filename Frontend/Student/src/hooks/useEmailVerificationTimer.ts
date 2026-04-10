import { useState, useEffect } from "react";

export const useEmailVerificationTimer = (initialSeconds: number = 90) => {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (timeRemaining <= 0) {
      setIsExpired(true);
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetTimer = (seconds: number = initialSeconds) => {
    setTimeRemaining(seconds);
    setIsExpired(false);
  };

  return {
    timeRemaining,
    isExpired,
    formattedTime: formatTime(timeRemaining),
    resetTimer,
  };
};
