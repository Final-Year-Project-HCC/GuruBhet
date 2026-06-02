"use client";

import "@livekit/components-styles";
import { type ReactNode } from "react";
import {
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useRemoteParticipants,
  ControlBar,
  Chat,
  LayoutContextProvider,
  useMaybeLayoutContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";

function PiPVideoContent({ extraControls }: { extraControls?: ReactNode }) {
  const layoutContext = useMaybeLayoutContext();
  const showChat = layoutContext?.widget.state?.showChat ?? false;

  // Subscribe to both camera and screen-share tracks
  const allTracks = useTracks([
    Track.Source.Camera,
    Track.Source.ScreenShare,
  ]);

  const remoteCamera = allTracks.find(
    (t) => !t.participant.isLocal && t.source === Track.Source.Camera && t.publication?.isSubscribed
  ) ?? null;
  const remoteScreen = allTracks.find(
    (t) => !t.participant.isLocal && t.source === Track.Source.ScreenShare && t.publication?.isSubscribed
  ) ?? null;
  // Local PiP: prefer screen share, fall back to camera
  const localPip = allTracks.find(
    (t) => t.participant.isLocal && t.source === Track.Source.ScreenShare
  ) ?? allTracks.find(
    (t) => t.participant.isLocal && t.source === Track.Source.Camera
  ) ?? null;

  // Main view: remote screen share takes priority over remote camera
  const mainTrack = remoteScreen ?? remoteCamera;
  const mainObjectFit = remoteScreen ? "contain" : "cover";

  const remoteParticipants = useRemoteParticipants();
  const remoteParticipant = remoteParticipants[0] ?? null;

  const remoteInitial = remoteParticipant?.name
    ? remoteParticipant.name.charAt(0).toUpperCase()
    : "?";

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Remote participant — full-screen (screen share or camera) */}
      {mainTrack ? (
        <VideoTrack
          trackRef={mainTrack}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: mainObjectFit }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-neutral-700 flex items-center justify-center text-white text-4xl font-bold select-none">
              {remoteInitial}
            </div>
            {remoteParticipant ? (
              <p className="text-neutral-400 text-sm font-medium">
                {remoteParticipant.name ?? "Participant"} — camera off
              </p>
            ) : (
              <p className="text-neutral-500 text-sm font-medium">
                Waiting for the other participant…
              </p>
            )}
          </div>
        </div>
      )}

      {/* Local participant — PiP bottom-right, above control bar */}
      {localPip && (
        <div
          className="absolute z-10 overflow-hidden rounded-2xl shadow-2xl"
          style={{
            width: 160,
            height: 112,
            bottom: 80,
            right: 16,
            border: "2px solid rgba(255,255,255,0.25)",
          }}
        >
          <VideoTrack
            trackRef={localPip}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/*
        Chat panel — always mounted so LiveKit's data-channel listener stays
        active and incoming messages are never lost. Visibility toggled via
        CSS transform instead of conditional rendering.
      */}
      <div
        className="absolute right-0 top-0 z-20 flex flex-col bg-neutral-900 border-l border-neutral-700"
        style={{
          width: 320,
          bottom: 64,
          transform: showChat ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.2s ease",
        }}
      >
        <Chat />
      </div>

      {/* Control bar — overlaid at bottom, leave button hidden */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-3">
        <ControlBar controls={{ leave: false, chat: true }} />
        {extraControls}
      </div>

      {/* Audio always rendered */}
      <RoomAudioRenderer />
    </div>
  );
}

/**
 * Messenger/FaceTime-style PiP video layout.
 * Wraps PiPVideoContent in a LayoutContextProvider so the ControlBar's
 * chat toggle communicates with the Chat panel.
 */
export default function PiPVideoLayout({ extraControls }: { extraControls?: ReactNode }) {
  return (
    <LayoutContextProvider>
      <PiPVideoContent extraControls={extraControls} />
    </LayoutContextProvider>
  );
}
