# 💻 Code Examples

**For:** Copy-paste ready code snippets  
**Time:** 15 minutes  
**Note:** All examples are production-ready

---

## Context Providers (Setup)

These must exist in your app beforeimport { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { useBooking } from '@/contexts/BookingContext';
import { useLiveKit } from '@/hooks/useLiveKit';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/router';g the hooks/components.

### SocketContext.tsx

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
```

### BookingContext.tsx

```typescript
import React, { createContext, useContext, useState } from 'react';

interface BookingContextType {
  currentBookingId: string | null;
  setCurrentBookingId: (id: string | null) => void;
}

const BookingContext = createContext<BookingContextType>({
  currentBookingId: null,
  setCurrentBookingId: () => {},
});

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);

  return (
    <BookingContext.Provider value={{ currentBookingId, setCurrentBookingId }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  return useContext(BookingContext);
}
```

### ToastContext.tsx

```typescript
import React, { createContext, useContext, useCallback, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  toasts: [],
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    const toast = { id, message, type };

    setToasts(prev => [...prev, toast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toasts }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
```

### useLiveKit.tsx (STATE MANAGEMENT FOR LIVEKIT)

**Purpose:** Centralized global state for LiveKit configuration (token, room name, server URL)

This is used by `useSessionSync` to update the token on reconnection, and by `SessionVideoComponent` to stay in sync with the current connection.

```typescript
import React, { createContext, useContext, useState, useCallback } from 'react';

interface LiveKitConfig {
  token: string;
  url: string;
  roomName: string;
}

interface LiveKitContextType {
  config: LiveKitConfig | null;
  initializeLiveKit: (config: LiveKitConfig) => void;
  clearLiveKit: () => void;
}

const LiveKitContext = createContext<LiveKitContextType>({
  config: null,
  initializeLiveKit: () => {},
  clearLiveKit: () => {},
});

export function LiveKitProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<LiveKitConfig | null>(null);

  const initializeLiveKit = useCallback((newConfig: LiveKitConfig) => {
    console.log('[LiveKitProvider] Initializing with room:', newConfig.roomName);
    setConfig(newConfig);
  }, []);

  const clearLiveKit = useCallback(() => {
    console.log('[LiveKitProvider] Clearing LiveKit config');
    setConfig(null);
  }, []);

  return (
    <LiveKitContext.Provider value={{ config, initializeLiveKit, clearLiveKit }}>
      {children}
    </LiveKitContext.Provider>
  );
}

export function useLiveKit() {
  return useContext(LiveKitContext);
}
```

---

## useSessionSync Hook

Complete, copy-paste ready:

```typescript
import { useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useBooking } from "@/contexts/BookingContext";
import { useToast } from "@/hooks/useToast";
import { useRouter } from "next/router";

export interface LiveKitToken {
  token: string;
  room_name: string;
  livekit_url: string;
}

interface SyncOptions {
  onSuccess?: (data: LiveKitToken) => void;
  onExpired?: () => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
}

/**
 * Hook for syncing session state on socket reconnection
 *
 * @param options Configuration for sync behavior
 * @returns Object with sync function
 *
 * @example
 * const { sync } = useSessionSync({
 *   onSuccess: (data) => setToken(data.token),
 *   onExpired: () => router.push('/dashboard'),
 *   autoReconnect: true,
 * });
 *
 * // Manual sync
 * await sync();
 *
 * // Auto-sync on socket reconnect (if autoReconnect=true)
 */
export function useSessionSync(options: SyncOptions = {}) {
  const { onSuccess, onExpired, onError, autoReconnect = true } = options;
  const { socket, isConnected } = useSocket();
  const { currentBookingId } = useBooking();
  const { initializeLiveKit } = useLiveKit();
  const { showToast } = useToast();
  const router = useRouter();
  const syncInProgressRef = useRef(false);

  const sync = useCallback(async () => {
    if (!currentBookingId) {
      console.debug("[useSessionSync] No booking ID");
      return;
    }

    if (syncInProgressRef.current) {
      console.debug("[useSessionSync] Sync already in progress");
      return;
    }

    syncInProgressRef.current = true;

    try {
      const response = await fetch(
        `/api/v1/bookings/${currentBookingId}/sync`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );

      // Session expired - user is outside the session window
      if (response.status === 403) {
        console.warn("[useSessionSync] Session expired (403)");
        showToast("Session window has expired", "warning");
        onExpired?.();
        router.push("/dashboard?reason=session_expired");
        return;
      }

      // Session gone - initialization window expired
      if (response.status === 410) {
        console.warn("[useSessionSync] Session gone (410)");
        showToast("Session no longer available", "error");
        onExpired?.();
        router.push("/dashboard?reason=session_gone");
        return;
      }

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const data: LiveKitToken = await response.json();
      console.info("[useSessionSync] Sync successful");

      // Update global LiveKit state, which triggers SessionVideoComponent re-render
      initializeLiveKit({
        token: data.token,
        url: data.livekit_url,
        roomName: data.room_name,
      });

      onSuccess?.(data);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      console.error("[useSessionSync] Sync failed:", err);
      onError?.(err);
      showToast("Failed to reconnect", "error");
    } finally {
      syncInProgressRef.current = false;
    }
  }, [
    currentBookingId,
    initializeLiveKit,
    onSuccess,
    onExpired,
    onError,
    showToast,
    router,
  ]);

  // Auto-sync on socket reconnect
  useEffect(() => {
    if (!socket || !autoReconnect || !isConnected) return;

    const handleConnect = () => {
      console.info("[useSessionSync] Socket connected, syncing...");
      sync();
    };

    socket.on("connect", handleConnect);
    return () => socket.off("connect", handleConnect);
  }, [socket, autoReconnect, isConnected, sync]);

  return { sync };
}
```

---

## SessionVideoComponent

Complete, copy-paste ready:

```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { useSessionSync, LiveKitToken } from '@/hooks/useSessionSync';
import { useLiveKit } from '@/hooks/useLiveKit';
import { useToast } from '@/hooks/useToast';

interface SessionVideoComponentProps {
  bookingId: string;
  sessionId: string;
  initialToken: string;
  initialRoomName: string;
  liveKitUrl: string;
}

/**
 * Component that wraps LiveKit room with reconnection handling
 *
 * @param props Session connection details
 * @returns JSX for video session
 *
 * @example
 * <SessionVideoComponent
 *   bookingId="booking-123"
 *   sessionId="session-456"
 *   initialToken="eyJ0eXAi..."
 *   initialRoomName="room-abc"
 *   liveKitUrl="https://livekit.example.com"
 * />
 */
export function SessionVideoComponent({
  bookingId,
  sessionId,
  initialToken,
  initialRoomName,
  liveKitUrl,
}: SessionVideoComponentProps) {
  const { showToast } = useToast();
  const { config: liveKitConfig } = useLiveKit();
  const [token, setToken] = useState<string>(initialToken);
  const [roomName, setRoomName] = useState<string>(initialRoomName);
  const [isReady, setIsReady] = useState(false);
  const liveKitRoomRef = useRef<any>(null);

  // Watch for changes from useLiveKit (when sync updates the token)
  useEffect(() => {
    if (liveKitConfig) {
      console.info('[SessionVideoComponent] LiveKit config updated');
      setToken(liveKitConfig.token);
      setRoomName(liveKitConfig.roomName);
      // Force re-render of LiveKitRoom with new token
      setIsReady(false);
      setTimeout(() => setIsReady(true), 100);
    }
  }, [liveKitConfig]);

  const handleSyncSuccess = useCallback((data: LiveKitToken) => {
    // The hook already called initializeLiveKit, which updated useLiveKit state
    // The useEffect above will trigger and update our local state
    console.info('[SessionVideoComponent] Sync successful');
    showToast('Reconnected to session', 'success');
  }, [showToast]);

  const handleSessionExpired = useCallback(() => {
    console.warn('[SessionVideoComponent] Session expired');
    setIsReady(false);
  }, []);

  const { sync } = useSessionSync({
    onSuccess: handleSyncSuccess,
    onExpired: handleSessionExpired,
    autoReconnect: true,
  });

  const handleManualSync = useCallback(async () => {
    showToast('Reconnecting...', 'info');
    await sync();
  }, [sync, showToast]);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Connecting to session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <button
        onClick={handleManualSync}
        className="absolute top-4 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        title="Manually reconnect to session"
      >
        🔄 Reconnect
      </button>

      <LiveKitRoom
        ref={liveKitRoomRef}
        video={true}
        audio={true}
        token={token}
        connect={true}
        serverUrl={liveKitUrl}
        roomName={roomName}
        onError={(error) => {
          console.error('[SessionVideoComponent] LiveKit error:', error);
          showToast(`Connection error: ${error.message}`, 'error');
        }}
        onConnected={() => {
          console.info('[SessionVideoComponent] Connected to LiveKit');
          showToast('Connected to session', 'success');
        }}
        onDisconnected={() => {
          console.warn('[SessionVideoComponent] Disconnected from LiveKit');
        }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
```

---

## Session Page

Complete, copy-paste ready:

```typescript
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { SessionVideoComponent } from '@/components/SessionVideoComponent';
import { useBooking } from '@/contexts/BookingContext';
import { useToast } from '@/hooks/useToast';

interface SessionInitData {
  token: string;
  room_name: string;
  livekit_url: string;
}

/**
 * Session page - entry point for video sessions
 *
 * Route: /session/[bookingId]/[sessionId]
 *
 * Flow:
 * 1. Extract IDs from URL
 * 2. Call POST /accept to initialize session
 * 3. If 410 (window expired) → show error
 * 4. If 400 (already accepted) → get token from GET endpoint
 * 5. Render SessionVideoComponent with token
 */
export default function SessionPage() {
  const router = useRouter();
  const { bookingId, sessionId } = router.query as {
    bookingId?: string;
    sessionId?: string;
  };

  const { setCurrentBookingId } = useBooking();
  const { showToast } = useToast();
  const [sessionData, setSessionData] = useState<SessionInitData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const acceptSession = async () => {
    if (!bookingId || !sessionId) {
      setError('Missing booking or session ID');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/bookings/${bookingId}/sessions/${sessionId}/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      // Initialization window expired (more than 60 seconds since start)
      if (response.status === 410) {
        const errorMsg = 'Session window expired. Ask teacher to start again.';
        setError(errorMsg);
        showToast(errorMsg, 'error');
        return;
      }

      // Session already accepted - get fresh token
      if (response.status === 400) {
        console.info('[SessionPage] Session already accepted, getting token...');
        await getSessionToken();
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to accept: ${response.statusText}`);
      }

      const data: SessionInitData = await response.json();
      setCurrentBookingId(bookingId);
      setSessionData(data);
      showToast('Session accepted! Connecting...', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getSessionToken = async () => {
    if (!bookingId || !sessionId) {
      setError('Missing IDs');
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/bookings/${bookingId}/sessions/${sessionId}/livekit-token`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.statusText}`);
      }

      const data: SessionInitData = await response.json();
      setCurrentBookingId(bookingId);
      setSessionData(data);
      showToast('Connected to session', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get token';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingId || !sessionId) return;
    acceptSession();
  }, [bookingId, sessionId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Initializing session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="bg-red-900 p-8 rounded-lg text-white text-center max-w-md">
          <h1 className="text-xl font-bold mb-4">Session Error</h1>
          <p className="mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white text-center">
          <p>No session data available</p>
        </div>
      </div>
    );
  }

  return (
    <SessionVideoComponent
      bookingId={bookingId!}
      sessionId={sessionId!}
      initialToken={sessionData.token}
      initialRoomName={sessionData.room_name}
      liveKitUrl={sessionData.livekit_url}
    />
  );
}
```

---

## Quick Integration Snippets

### Wrap app with providers

```typescript
// pages/_app.tsx
import { SocketProvider } from '@/contexts/SocketContext';
import { BookingProvider } from '@/contexts/BookingContext';
import { ToastProvider } from '@/contexts/ToastContext';

function MyApp({ Component, pageProps }) {
  return (
    <SocketProvider>
      <BookingProvider>
        <ToastProvider>
          <Component {...pageProps} />
        </ToastProvider>
      </BookingProvider>
    </SocketProvider>
  );
}

export default MyApp;
```

### Link to session

```typescript
// components/BookingCard.tsx
import Link from 'next/link';

export function BookingCard({ booking }) {
  return (
    <div>
      <h3>{booking.subject}</h3>
      <p>{booking.start_time}</p>
      <Link href={`/session/${booking.id}/${booking.session_id}`}>
        <a className="btn btn-primary">Join Session</a>
      </Link>
    </div>
  );
}
```

### Manual sync button

```typescript
// components/ManualSyncButton.tsx
import { useSessionSync } from '@/hooks/useSessionSync';
import { useState } from 'react';

export function ManualSyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { sync } = useSessionSync();

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await sync();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Syncing...' : 'Reconnect'}
    </button>
  );
}
```

### Environment variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
NEXT_PUBLIC_LIVEKIT_URL=https://your-livekit-server.com
```

---

## Error Scenario Examples

### Handle 403 Expired

```typescript
const handleSyncError = (error: Error) => {
  if (error.message.includes("403")) {
    showToast("Your session has ended", "warning");
    router.push("/dashboard?reason=expired");
  }
};

useSessionSync({ onError: handleSyncError });
```

### Handle 410 Gone

```typescript
const handleExpired = () => {
  showToast(
    "Session request expired. Ask your teacher to start again.",
    "error",
  );
  router.push("/sessions");
};

useSessionSync({ onExpired: handleExpired });
```

### Retry on failure

```typescript
const { sync } = useSessionSync();

const syncWithRetry = async (maxAttempts = 3) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await sync();
      break;
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
};
```

---

## Types Reference

```typescript
// LiveKit token response
interface LiveKitToken {
  token: string; // JWT token for LiveKit
  room_name: string; // Room name to join
  livekit_url: string; // LiveKit server URL
}

// Sync options
interface SyncOptions {
  onSuccess?: (data: LiveKitToken) => void;
  onExpired?: () => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean; // Auto-sync on socket reconnect (default: true)
}

// Component props
interface SessionVideoComponentProps {
  bookingId: string;
  sessionId: string;
  initialToken: string;
  initialRoomName: string;
  liveKitUrl: string;
}
```

---

## Next Steps

- [ ] Copy providers to your context folder
- [ ] Copy useSessionSync hook to your hooks folder
- [ ] Copy SessionVideoComponent to your components folder
- [ ] Copy Session page to your pages folder
- [ ] Set environment variables
- [ ] Test in browser
- [ ] See TESTING-GUIDE.md for unit tests

---

**Questions?** See `ERROR-HANDLING.md` or `TROUBLESHOOTING.md`
