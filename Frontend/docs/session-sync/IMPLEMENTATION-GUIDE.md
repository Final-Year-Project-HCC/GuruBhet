# 📋 Frontend Implementation Guide

**For:** Frontend developers ready to code  
**Time:** 2-3 hours  
**Prerequisite:** Read `00-START-HERE.md` and `ARCHITECTURE-OVERVIEW.md`

---

## Overview

You'll create **3 new files** (~420 lines total):

1. `src/hooks/useSessionSync.ts` (130 lines) — Socket listener + sync logic
2. `src/components/SessionVideoComponent.tsx` (130 lines) — LiveKit wrapper
3. `src/pages/session/[bookingId]/[sessionId].tsx` (160 lines) — Session page

**Total Time: 2-3 hours**

---

## Prerequisites

Before you start, ensure you have:

```bash
✅ Node.js 16+
✅ Next.js 13+ (app/pages router)
✅ React 18+
✅ TypeScript 4.9+
✅ npm/yarn/pnpm installed

# Install required packages
npm install @livekit/components-react livekit-client socket.io-client
```

Verify installation:

```bash
npm list @livekit/components-react livekit-client socket.io-client
```

### useLiveKit Context Hook

**Important:** You also need a `useLiveKit` hook for managing LiveKit token/room globally:

```typescript
// This should already exist in src/hooks/useLiveKit.ts
// If not, copy from CODE-EXAMPLES.md → useLiveKit.tsx section
import { useLiveKit } from "@/hooks/useLiveKit";
```

**Why:** This hook manages:

- LiveKit token (JWT)
- LiveKit server URL
- Room name

It's used by `useSessionSync` to refresh the token on reconnect, and by `SessionVideoComponent` to re-render with new connection details.

**Wrap your app with LiveKitProvider:**

```typescript
// pages/_app.tsx
import { LiveKitProvider } from '@/hooks/useLiveKit';

function MyApp({ Component, pageProps }) {
  return (
    <LiveKitProvider>
      <Component {...pageProps} />
    </LiveKitProvider>
  );
}
```

---

## Phase 1: Create useSessionSync Hook (45 minutes)

### Step 1: Create file

```bash
touch src/hooks/useSessionSync.ts
```

### Step 2: Add code

Copy from `CODE-EXAMPLES.md` → `useSessionSync Hook` section

**Or use this template:**

```typescript
import { useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/contexts/SocketContext";
import { useBooking } from "@/contexts/BookingContext";
import { useLiveKit } from "@/hooks/useLiveKit";
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

export function useSessionSync(options: SyncOptions = {}) {
  const { onSuccess, onExpired, onError, autoReconnect = true } = options;
  const { socket, isConnected } = useSocket();
  const { currentBookingId } = useBooking();
  const { initializeLiveKit } = useLiveKit(); // ← ADD THIS
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

      if (response.status === 403) {
        console.warn("[useSessionSync] Session expired (403)");
        showToast("Session window has expired", "warning");
        onExpired?.();
        router.push("/dashboard?reason=session_expired");
        return;
      }

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
      // Update global LiveKit state
      initializeLiveKit({
        token: data.token,
        url: data.livekit_url,
        roomName: data.room_name,
      });
      onSuccess?.(data);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown");
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

### Step 3: Verify

```bash
# Check TypeScript compilation
npx tsc --noEmit

# Should show no errors
```

**Time: 45 minutes** ✅

---

## Phase 2: Create SessionVideoComponent (45 minutes)

### Step 1: Create file

```bash
touch src/components/SessionVideoComponent.tsx
```

### Step 2: Add code

Copy from `CODE-EXAMPLES.md` → `SessionVideoComponent` section

**Or use this template:**

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { useSessionSync, LiveKitToken } from '@/hooks/useSessionSync';
import { useToast } from '@/hooks/useToast';

interface SessionVideoComponentProps {
  bookingId: string;
  sessionId: string;
  initialToken: string;
  initialRoomName: string;
  liveKitUrl: string;
}

export function SessionVideoComponent({
  bookingId,
  sessionId,
  initialToken,
  initialRoomName,
  liveKitUrl,
}: SessionVideoComponentProps) {
  const { showToast } = useToast();
  const [token, setToken] = useState<string>(initialToken);
  const [roomName, setRoomName] = useState<string>(initialRoomName);
  const [isReady, setIsReady] = useState(false);

  const handleSyncSuccess = useCallback((data: LiveKitToken) => {
    console.info('[SessionVideoComponent] Sync successful, updating token');
    setToken(data.token);
    setRoomName(data.room_name);
    setIsReady(false);
    setTimeout(() => setIsReady(true), 100);
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

### Step 3: Verify

```bash
# Check TypeScript compilation
npx tsc --noEmit
```

**Time: 45 minutes** ✅

---

## Phase 3: Create Session Page (30 minutes)

### Step 1: Create file

```bash
mkdir -p src/pages/session/[bookingId]
touch src/pages/session/[bookingId]/[sessionId].tsx
```

### Step 2: Add code

Copy from `CODE-EXAMPLES.md` → `Session Page` section

**Or use this template:**

```typescript
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { SessionVideoComponent } from '@/components/SessionVideoComponent';
import { useToast } from '@/hooks/useToast';

interface SessionInitData {
  token: string;
  room_name: string;
  livekit_url: string;
}

export default function SessionPage() {
  const router = useRouter();
  const { bookingId, sessionId } = router.query as {
    bookingId?: string;
    sessionId?: string;
  };

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

      if (response.status === 410) {
        const errorMsg = 'Session window expired. Ask teacher to start again.';
        setError(errorMsg);
        showToast(errorMsg, 'error');
        return;
      }

      if (response.status === 400) {
        console.info('[SessionPage] Session already accepted, getting token...');
        await getSessionToken();
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to accept: ${response.statusText}`);
      }

      const data: SessionInitData = await response.json();
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

### Step 3: Verify

```bash
# Check TypeScript compilation
npx tsc --noEmit

# Check Next.js builds correctly
npm run build
```

**Time: 30 minutes** ✅

---

## Phase 4: Test in Browser (30 minutes)

### Test 1: Happy Path

```bash
# Start dev server
npm run dev

# In browser:
1. Navigate to /session/[bookingId]/[sessionId]
2. Page should load and call POST /accept
3. Should show "Initializing..." then video component
4. Should show "Connected to session" toast
5. Should see video stream
6. Should see "🔄 Reconnect" button
```

### Test 2: Network Failure

```bash
# In browser DevTools:
1. Open Network tab
2. Click "Offline" (simulate network failure)
3. UI should show "Reconnecting..." toast
4. Click "Online" to recover network
5. useSessionSync should auto-call /sync
6. Video should resume automatically
7. "Reconnecting..." toast should disappear
```

### Test 3: Manual Reconnect

```bash
1. Click "🔄 Reconnect" button
2. Should call GET /sync
3. Should show "Reconnecting..." toast
4. Should show "Reconnected to session" toast
5. Token should update in console logs
```

### Test 4: Error Cases

```bash
# In backend, make /sync return 403:
1. Click reconnect button
2. Should show "Session window has expired" toast
3. Should redirect to /dashboard
4. URL should be /dashboard?reason=session_expired
```

**Time: 30 minutes** ✅

---

## Quick Checklist

- [ ] Created `src/hooks/useSessionSync.ts`
- [ ] Created `src/components/SessionVideoComponent.tsx`
- [ ] Created `src/pages/session/[bookingId]/[sessionId].tsx`
- [ ] All TypeScript compiles without errors
- [ ] npm run build succeeds
- [ ] Tested happy path in browser
- [ ] Tested network failure scenario
- [ ] Tested manual reconnect
- [ ] Tested error cases

---

## Troubleshooting During Implementation

### "Cannot find module 'react'"

```bash
npm install react react-dom
```

### "Cannot find module 'next/router'"

- Ensure you're using Next.js pages router (not app router)
- Or use `next/navigation` if using app router

### TypeScript errors on Socket.IO

```bash
npm install --save-dev @types/socket.io-client
```

### LiveKit component not rendering

- Check token is valid
- Check serverUrl is correct
- Check roomName matches backend
- Check browser console for errors

---

## File Structure After Implementation

```
src/
├── hooks/
│   └── useSessionSync.ts          ✅ NEW
├── components/
│   └── SessionVideoComponent.tsx  ✅ NEW
├── pages/
│   ├── session/
│   │   └── [bookingId]/
│   │       └── [sessionId].tsx    ✅ NEW
│   └── ...
├── contexts/
│   ├── SocketContext.tsx          (must exist)
│   ├── BookingContext.tsx         (must exist)
│   └── ...
└── ...
```

---

## Next Steps

- [ ] Run all tests: See `TESTING-GUIDE.md`
- [ ] Deploy to staging
- [ ] Test with real backend
- [ ] Get code review
- [ ] Deploy to production

---

**Total Implementation Time: 2-3 hours** ✅

**Next:** Go to `TESTING-GUIDE.md` to write unit tests!
