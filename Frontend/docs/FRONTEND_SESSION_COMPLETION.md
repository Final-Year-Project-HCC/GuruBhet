# Frontend Session Completion Guide

## Overview

When a teaching session ends, the frontend must:

1. **Listen for session completion** from backend (Socket.IO event)
2. **Handle LiveKit room disconnection** gracefully
3. **Trigger completion API call** if needed
4. **Show completion UI** with duration and rating prompt
5. **Redirect to rating page** or booking details

This guide covers the frontend implementation for all three roles (Student, Teacher, Staff).

---

## Architecture

### Event Flow

```
User Action: Teacher clicks "End Session"
    ↓
Call: POST /api/v1/bookings/{id}/sessions/{id}/complete
    ↓
Backend processes: Database updates, LiveKit cleanup, Redis cleanup
    ↓
Backend emits: Socket.IO "session_completed" event
    ↓
Frontend receives: sessionCompleted event in LiveKitRoom component
    ↓
UI Updates:
  - Show completion modal
  - Display duration
  - Show rating prompt link
    ↓
Auto-redirect or manual action
```

### Components Involved

```
┌──────────────────────────────┐
│   LiveKitRoom Component      │ (wrapper)
│  - Manages room lifecycle    │
│  - Listens for events        │
└──────────────────────────────┘
         │                │
         ▼                ▼
┌──────────────────┐  ┌──────────────────────┐
│ SessionControls  │  │ CompletionModal      │
│ - End button     │  │ - Show duration      │
│ - Teacher only   │  │ - Rating button      │
└──────────────────┘  └──────────────────────┘
         │                     │
         └─────────────────────┘
         Coordinated state
```

---

## Implementation

### 1. Session Controls Component

**File**: `Teacher/src/components/session/SessionControls.tsx`

```typescript
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SessionControlsProps {
  sessionId: string;
  bookingId: string;
  isTeacher: boolean;
  isInProgress: boolean;
}

export function SessionControls({
  sessionId,
  bookingId,
  isTeacher,
  isInProgress
}: SessionControlsProps) {
  const router = useRouter();
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEndSession = async () => {
    if (!isTeacher) {
      setError('Only teachers can end sessions');
      return;
    }

    if (!isInProgress) {
      setError('Session is not in progress');
      return;
    }

    setIsEnding(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/bookings/${bookingId}/sessions/${sessionId}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to end session');
      }

      const session = await response.json();
      console.log('Session completed:', session);

      // Optional: Redirect immediately
      // The Socket.IO event will trigger modal, but we can auto-redirect
      // setTimeout(() => {
      //   router.push(`/bookings/${bookingId}`);
      // }, 2000);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to end session: ${message}`);
      setIsEnding(false);
    }
  };

  if (!isTeacher) {
    return null; // Students don't see end button
  }

  return (
    <div className="session-controls">
      <button
        onClick={handleEndSession}
        disabled={!isInProgress || isEnding}
        className="btn btn-danger"
      >
        {isEnding ? 'Ending...' : 'End Session'}
      </button>

      {error && (
        <div className="alert alert-danger mt-2">
          {error}
        </div>
      )}
    </div>
  );
}
```

### 2. LiveKit Room Integration

**File**: `Teacher/src/components/session/LiveKitRoom.tsx`

```typescript
import { useEffect, useState } from 'react';
import { LiveKitRoom, useRoom } from '@livekit/components-react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { CompletionModal } from './CompletionModal';

interface LiveKitSessionProps {
  sessionId: string;
  bookingId: string;
  roomName: string;
  token: string;
  isTeacher: boolean;
}

export function SessionLiveKitRoom({
  sessionId,
  bookingId,
  roomName,
  token,
  isTeacher,
}: LiveKitSessionProps) {
  const { room } = useRoom();
  const { socket } = useLiveKit();
  const [isCompleted, setIsCompleted] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Listen for session completion event
  useEffect(() => {
    if (!socket) return;

    const handleSessionCompleted = (event: {
      session_id: string;
      booking_id: string;
      duration_seconds: number;
      completed_at: string;
    }) => {
      console.log('Session completed event received:', event);
      setIsCompleted(true);
      setDurationSeconds(event.duration_seconds);
      setShowCompletionModal(true);

      // Also disconnect from room
      if (room) {
        room.disconnect();
      }
    };

    socket.on('session_completed', handleSessionCompleted);

    return () => {
      socket.off('session_completed', handleSessionCompleted);
    };
  }, [socket, room]);

  // Handle disconnection (both voluntary and forced)
  useEffect(() => {
    if (!room) return;

    const handleDisconnected = async () => {
      console.log('Room disconnected');

      // If teacher and session is in progress, auto-complete
      if (isTeacher && !isCompleted) {
        try {
          await fetch(
            `/api/v1/bookings/${bookingId}/sessions/${sessionId}/complete`,
            {
              method: 'POST',
            }
          );
        } catch (err) {
          console.error('Auto-completion failed:', err);
        }
      }

      setShowCompletionModal(true);
    };

    room.on('disconnected', handleDisconnected);

    return () => {
      room.off('disconnected', handleDisconnected);
    };
  }, [room, isTeacher, bookingId, sessionId, isCompleted]);

  return (
    <>
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        connect={true}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        data-lk-theme="dark"
      >
        {/* LiveKit UI Components */}
      </LiveKitRoom>

      {showCompletionModal && (
        <CompletionModal
          sessionId={sessionId}
          bookingId={bookingId}
          durationSeconds={durationSeconds}
          onClose={() => setShowCompletionModal(false)}
        />
      )}
    </>
  );
}
```

### 3. Completion Modal Component

**File**: `Teacher/src/components/session/CompletionModal.tsx`

```typescript
import { useRouter } from 'next/navigation';
import { formatDuration } from '@/utils/time';

interface CompletionModalProps {
  sessionId: string;
  bookingId: string;
  durationSeconds: number | null;
  onClose: () => void;
}

export function CompletionModal({
  sessionId,
  bookingId,
  durationSeconds,
  onClose,
}: CompletionModalProps) {
  const router = useRouter();

  const handleRateNow = () => {
    // Navigate to rating page
    router.push(`/bookings/${bookingId}/rate/${sessionId}`);
  };

  const handleViewBooking = () => {
    router.push(`/bookings/${bookingId}`);
  };

  const durationText = durationSeconds
    ? formatDuration(durationSeconds)
    : 'N/A';

  return (
    <div className="modal show d-block" role="dialog">
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">Session Completed! ✓</h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            />
          </div>

          <div className="modal-body">
            <div className="text-center mb-4">
              <p className="fs-1">🎉</p>
              <h6 className="text-muted">Session Duration</h6>
              <p className="fs-5 fw-bold">{durationText}</p>
            </div>

            <div className="alert alert-info">
              <small>
                Thank you for the session! Please rate your experience to help
                improve our platform.
              </small>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleViewBooking}
            >
              View Booking
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRateNow}
            >
              Rate Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4. Socket.IO Integration Hook

**File**: `Teacher/src/hooks/useLiveKit.ts` (Add to existing)

```typescript
// Existing useLiveKit hook
export function useLiveKit() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const socket = io(process.env.NEXT_PUBLIC_API_URL, {
      auth: {
        token: getAuthToken(),
      },
    });

    socketRef.current = socket;

    // Listen for session completion
    socket.on("session_completed", (data) => {
      console.log("Session completed:", data);
      // Event handled in LiveKitRoom component
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
  };
}
```

### 5. Time Formatting Utility

**File**: `Teacher/src/utils/time.ts`

```typescript
/**
 * Format seconds into human-readable duration
 *
 * Examples:
 * - 60 -> "1 minute"
 * - 3600 -> "1 hour"
 * - 3660 -> "1 hour 1 minute"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  }
  if (secs > 0 && parts.length === 0) {
    parts.push(`${secs} second${secs > 1 ? "s" : ""}`);
  }

  return parts.join(" ");
}
```

---

## Socket.IO Event Details

### Event: `session_completed`

**Direction**: Server → Client  
**Broadcast**: To all participants in the room

**Payload**:

```typescript
{
  session_id: string; // UUID
  booking_id: string; // UUID
  duration_seconds: number; // Seconds elapsed
  completed_at: string; // ISO 8601 timestamp
}
```

**When emitted**:

- Immediately after backend processes completion
- To room via Socket.IO room broadcast

**Example handler**:

```typescript
socket.on("session_completed", (event) => {
  console.log(`Session lasted ${event.duration_seconds} seconds`);

  // Show UI
  setSessionComplete(true);
  setDuration(event.duration_seconds);

  // Optionally redirect
  setTimeout(() => {
    navigate(`/bookings/${event.booking_id}`);
  }, 3000);
});
```

---

## Error Scenarios

### Scenario 1: Teacher Network Drop

```
Teacher's connection drops mid-session
    ↓
Frontend detects: room.on('disconnected')
    ↓
Frontend auto-completes: POST /complete
    ↓
Backend processes completion normally
    ↓
Teacher receives Socket.IO event even if offline
    ↓
Next time online, modal appears when reconnecting
```

**Code**:

```typescript
const handleDisconnected = async () => {
  if (isTeacher && !isCompleted) {
    try {
      await fetch(
        `/api/v1/bookings/${bookingId}/sessions/${sessionId}/complete`,
        {
          method: "POST",
        },
      );
    } catch (err) {
      // Network error, but session might be completed on server
      // Show message to retry or check manually
      console.error("Failed to complete session", err);
    }
  }
};
```

### Scenario 2: Socket.IO Event Arrives Before Disconnect

```
Backend emits: "session_completed" event
    ↓
Frontend receives: Handles normally
    ↓
Frontend shows: Modal with duration
    ↓
User clicks: "Rate Now" button
    ↓
Navigate to: /rate-session/{sessionId}
```

### Scenario 3: Completion API Fails

```
Teacher clicks: "End Session"
    ↓
Frontend calls: POST /complete
    ↓
API returns: 400 or 500 error
    ↓
Frontend shows: Error message
    ↓
User can retry: Or refresh page to check status
```

**Code**:

```typescript
try {
  const response = await fetch(`/api/v1/.../complete`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Completion failed");
  }
} catch (err) {
  setError(`Failed to end session: ${err.message}`);
  // User can retry
}
```

---

## Student View

Students don't see the "End Session" button but still receive:

- Session completion notification via Socket.IO
- Completion modal when backend emits event
- Rating prompt after completion

```typescript
// In Student view, no controls shown
{isTeacher && (
  <SessionControls ... />
)}

// But still listen for completion
useEffect(() => {
  socket.on('session_completed', (data) => {
    setShowCompletionModal(true);
  });
}, []);
```

---

## Testing

### Unit Tests

Test individual components:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { SessionControls } from './SessionControls';

describe('SessionControls', () => {
  it('should call API when teacher clicks end', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    render(
      <SessionControls
        sessionId="123"
        bookingId="456"
        isTeacher={true}
        isInProgress={true}
      />
    );

    const button = screen.getByText('End Session');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/bookings/456/sessions/123/complete',
        { method: 'POST' }
      );
    });
  });
});
```

### Integration Tests

Test full flow with WebSockets:

```typescript
async function testSessionCompletion() {
  // 1. Create session
  const session = await createTestSession();

  // 2. Join room
  const { room, token } = await joinSession(session.id);

  // 3. Listen for completion
  const completionPromise = new Promise((resolve) => {
    socket.on("session_completed", resolve);
  });

  // 4. Trigger completion
  await fetch(
    `/api/v1/bookings/${session.booking_id}/sessions/${session.id}/complete`,
    {
      method: "POST",
    },
  );

  // 5. Verify event received
  const event = await completionPromise;
  expect(event.duration_seconds).toBeGreaterThan(0);
  expect(event.session_id).toBe(session.id);
}
```

---

## Best Practices

1. **Always listen for Socket.IO events**: Don't rely solely on API response
2. **Handle network failures gracefully**: Show error message and retry option
3. **Show clear completion UX**: Modal or toast to confirm session is done
4. **Collect rating immediately**: Use post-completion modal to request rating
5. **Avoid race conditions**: Check session status before auto-completing
6. **Clean up listeners**: Remove Socket.IO listeners on unmount
7. **Log completion flows**: Help diagnose issues in production

---

## FAQ

**Q: What if Socket.IO event never arrives?**  
A: The session is still completed on the backend. User can refresh page to see updated status, or navigate manually.

**Q: Can student end a session?**  
A: No. Only the teacher can call the `/complete` endpoint. But if teacher disconnects, system will auto-complete after timeout.

**Q: What happens if both disconnect?**  
A: The session stays IN_PROGRESS until teacher explicitly ends it or timeout expires.

**Q: Should we show a countdown timer?**  
A: Yes, it's good UX. Show session duration in progress as `HH:MM:SS`.

**Q: How to handle rating after completion?**  
A: Redirect to `/bookings/{id}/rate/{sessionId}` from completion modal.
