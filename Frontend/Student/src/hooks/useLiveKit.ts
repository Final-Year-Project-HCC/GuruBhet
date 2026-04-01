import { useCallback, useRef } from "react";
import { LocalParticipant, Room } from "livekit-client";

export interface LiveKitSession {
  room: Room | null;
  localParticipant: LocalParticipant | null;
  isInitialized: boolean;
}

export function useLiveKit() {
  const roomRef = useRef<Room | null>(null);
  const participantRef = useRef<LocalParticipant | null>(null);

  const initializeLiveKit = useCallback(
    async (token: string, url: string, roomName: string) => {
      try {
        // This is a placeholder for LiveKit initialization
        // Import and use LiveKit client when ready
        console.log(
          "[useLiveKit] Initializing with token:",
          token.substring(0, 20) + "...",
          "URL:",
          url,
          "Room:",
          roomName,
        );

        // In production, you would initialize the LiveKit room here
        // const room = new Room();
        // await room.connect(url, token);

        return {
          room: roomRef.current,
          localParticipant: participantRef.current,
          isInitialized: true,
        };
      } catch (error) {
        console.error("[useLiveKit] Failed to initialize:", error);
        throw error;
      }
    },
    [],
  );

  const cleanup = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    participantRef.current = null;
  }, []);

  return {
    initializeLiveKit,
    cleanup,
    room: roomRef.current,
    localParticipant: participantRef.current,
  };
}
