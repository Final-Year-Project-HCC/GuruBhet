# 🔧 Documentation Fixes - Detailed Changes

**Quick reference for what to change in each file**

---

## File 1: CODE-EXAMPLES.md

### Change 1: Add useLiveKit Context Provider

**Location:** After "ToastContext.tsx" section

**Add this new section:**

````markdown
### useLiveKit.tsx (STATE MANAGEMENT FOR LIVEKIT)

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
````

**Why:** The actual implementation uses a centralized LiveKit state hook. This manages token, room name, and server URL globally, preventing duplicate management across components.

````

---

### Change 2: Update useSessionSync Hook

**Location:** "useSessionSync Hook" section

**Replace the entire sync function with:**

```typescript
const sync = useCallback(async () => {
  if (!currentBookingId) {
    console.debug('[useSessionSync] No booking ID in state');
    return;
  }

  if (syncInProgressRef.current) {
    console.debug('[useSessionSync] Sync already in progress');
    return;
  }

  syncInProgressRef.current = true;

  try {
    const response = await fetch(
      `/api/v1/bookings/${currentBookingId}/sync`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }
    );

    if (response.status === 403) {
      console.warn('[useSessionSync] Session expired (403)');
      showToast('Session window has expired', 'warning');
      onExpired?.();
      router.push('/dashboard?reason=session_expired');
      return;
    }

    if (response.status === 410) {
      console.warn('[useSessionSync] Session gone (410)');
      showToast('Session no longer available', 'error');
      onExpired?.();
      router.push('/dashboard?reason=session_gone');
      return;
    }

    if (!response.ok) {
      throw new Error(`Sync failed with status ${response.status}`);
    }

    const data: LiveKitToken = await response.json();
    console.info('[useSessionSync] Sync successful', { room_name: data.room_name });

    // Re-initialize LiveKit component with fresh token
    // This updates the global LiveKit state, triggering a re-render
    // in SessionVideoComponent
    initializeLiveKit({
      token: data.token,
      url: data.livekit_url,
      roomName: data.room_name,
    });

    onSuccess?.(data);
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('[useSessionSync] Sync failed:', err);
    onError?.(err);
    showToast('Failed to reconnect to session', 'error');
  } finally {
    syncInProgressRef.current = false;
  }
}, [
  currentBookingId,
  initializeLiveKit,  // ← ADD THIS
  onSuccess,
  onExpired,
  onError,
  showToast,
  router,
]);
````

**Add import at top:**

```typescript
import { useLiveKit } from "@/hooks/useLiveKit";
```

**Add to hook:**

```typescript
const { initializeLiveKit } = useLiveKit();
```

**Update dependencies:**

```typescript
useEffect(() => {
  if (!socket || !autoReconnect || !isConnected) {
    // ← ADD isConnected
    return;
  }

  const handleConnect = () => {
    console.info("[useSessionSync] Socket connected, syncing session...");
    sync();
  };

  socket.on("connect", handleConnect);
  return () => socket.off("connect", handleConnect);
}, [socket, autoReconnect, isConnected, sync]); // ← ADD isConnected
```

---

### Change 3: Update SessionVideoComponent

**Location:** "SessionVideoComponent" section

**Key changes:**

1. **Add to imports:**

```typescript
import { useLiveKit } from "@/hooks/useLiveKit";
```

2. **Add this inside component:**

```typescript
const { config: liveKitConfig } = useLiveKit();
```

3. **Update token/room from config:**

```typescript
useEffect(() => {
  if (liveKitConfig) {
    setToken(liveKitConfig.token);
    setRoomName(liveKitConfig.roomName);
    setIsReady(false);
    setTimeout(() => setIsReady(true), 100);
  }
}, [liveKitConfig]);
```

4. **Update initial state:**

```typescript
const [token, setToken] = useState<string>(initialToken || "");
const [roomName, setRoomName] = useState<string>(initialRoomName || "");
```

5. **Simplify handleSyncSuccess:**

```typescript
const handleSyncSuccess = useCallback(
  (data: LiveKitToken) => {
    console.info("[SessionVideoComponent] Sync successful, updating token");
    // The hook already called initializeLiveKit, which updated useLiveKit state
    // The useEffect above will trigger and update our local state
    showToast("Reconnected to session", "success");
  },
  [showToast],
);
```

6. **Update LiveKitRoom ref:**

```typescript
const liveKitRoomRef = useRef<any>(null);

// Use in component:
<LiveKitRoom
  ref={liveKitRoomRef}
  video={true}
  audio={true}
  token={token}
  connect={true}
  serverUrl={liveKitUrl}
  roomName={roomName}
  // ... rest of props
/>
```

---

## File 2: IMPLEMENTATION-GUIDE.md

### Change 1: Add useLiveKit to Prerequisites

**Location:** "Prerequisites" section, after "Install required packages"

**Add:**

````markdown
### LiveKit State Management

You also need a `useLiveKit` hook for managing LiveKit token/room globally:

```typescript
// This should already exist in src/hooks/useLiveKit.ts
// If not, copy the implementation from CODE-EXAMPLES.md → useLiveKit.tsx section
import { useLiveKit } from "@/hooks/useLiveKit";
```
````

This hook manages:

- LiveKit token (JWT)
- LiveKit server URL
- Room name

It's used by `useSessionSync` to refresh the token on reconnect, and by `SessionVideoComponent` to stay in sync.

```

---

### Change 2: Update Phase 1 instructions

**Location:** "Phase 1: Create useSessionSync Hook" section

**Update code template to include:**
```

# Add import

import { useLiveKit } from '@/hooks/useLiveKit';

# In hook body

const { initializeLiveKit } = useLiveKit();

# In sync function's success path

initializeLiveKit({
token: data.token,
url: data.livekit_url,
roomName: data.room_name,
});

# In dependencies

}, [
currentBookingId,
initializeLiveKit, // ← Important!
onSuccess,
onExpired,
onError,
showToast,
router,
]);

```

---

## File 3: ARCHITECTURE-OVERVIEW.md

### Change 1: Update State Management Diagram

**Location:** Component interaction section

**Add to diagram:**
```

┌──────────────────────────────────────────────────────────┐
│ Frontend Components │
├──────────────────────────────────────────────────────────┤
│ │
│ useLiveKit Context (Global State) │
│ ├─ token: string │
│ ├─ roomName: string │
│ └─ url: string │
│ │
│ SessionPage │
│ ├─ POST /accept → Gets initial token │
│ └─ Renders SessionVideoComponent │
│ │
│ SessionVideoComponent │
│ ├─ Listens to useLiveKit config changes │
│ ├─ Re-renders when token updates │
│ ├─ Renders LiveKitRoom with current token │
│ └─ Shows "🔄 Reconnect" button (calls sync) │
│ │
│ useSessionSync Hook │
│ ├─ Listens to Socket.IO reconnect │
│ ├─ Calls GET /sync to get fresh token │
│ └─ Updates useLiveKit state via initializeLiveKit() │
│ (which triggers SessionVideoComponent re-render) │
│ │
│ Socket.IO (Real-time) │
│ ├─ On "connect" event → useSessionSync calls sync() │
│ └─ On "disconnect" event → SessionVideoComponent shows │
│ reconnecting UI │
│ │
└──────────────────────────────────────────────────────────┘

````

---

## File 4: TESTING-GUIDE.md

### Change 1: Mock useLiveKit in tests

**Location:** Test setup section

**Add to mocks:**
```typescript
jest.mock('@/hooks/useLiveKit', () => ({
  useLiveKit: jest.fn(() => ({
    config: null,
    initializeLiveKit: jest.fn(),
    clearLiveKit: jest.fn(),
  })),
}));
````

### Change 2: Update hook test

**Location:** "useSessionSync hook" test section

**Update mock setup:**

```typescript
const mockInitializeLiveKit = jest.fn();
(useLiveKit as jest.Mock).mockReturnValue({
  config: null,
  initializeLiveKit: mockInitializeLiveKit,
  clearLiveKit: jest.fn(),
});

// In test
it("should call initializeLiveKit on sync", async () => {
  // ... setup
  await result.current.sync();

  expect(mockInitializeLiveKit).toHaveBeenCalledWith({
    token: "test-token",
    url: "https://livekit.example.com",
    roomName: "test-room",
  });
});
```

---

## File 5: 00-START-HERE.md

### Change: Update code example

**Location:** "3-File Architecture" section

**Update the hook usage example to show:**

```typescript
// useSessionSync now also calls initializeLiveKit
const { sync } = useSessionSync({
  onSuccess: (data) => {
    // Hook already updated useLiveKit state
    // SessionVideoComponent will automatically re-render
  },
  onExpired: () => router.push("/dashboard"),
});
```

---

## Summary of Changes

| File                     | Changes                                       | Time   |
| ------------------------ | --------------------------------------------- | ------ |
| CODE-EXAMPLES.md         | Add useLiveKit provider + update hooks        | 30 min |
| IMPLEMENTATION-GUIDE.md  | Add useLiveKit prerequisites + Phase 1 update | 15 min |
| ARCHITECTURE-OVERVIEW.md | Update state diagram + component interaction  | 10 min |
| TESTING-GUIDE.md         | Add useLiveKit mocks + test updates           | 10 min |
| 00-START-HERE.md         | Update code examples                          | 5 min  |

**Total:** ~70 minutes to update all documentation

---

**Ready to apply these changes?**
