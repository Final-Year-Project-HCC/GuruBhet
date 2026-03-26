# 🧪 Testing Guide

**For:** Frontend developers writing unit and integration tests  
**Time:** 20 minutes  
**Tools:** Jest, React Testing Library, Mock Service Worker

---

## Setup

### Install testing dependencies

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-mock-extended
npm install --save-dev @types/jest
npm install --save-dev msw  # Mock Service Worker for HTTP mocks
```

### Configure Jest

Create `jest.config.js`:

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
};
```

Create `src/setupTests.ts`:

```typescript
import "@testing-library/jest-dom";

// Mock fetch if needed
global.fetch = jest.fn();

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```

---

## Test Pattern 1: useSessionSync Hook

### File: `src/hooks/__tests__/useSessionSync.test.ts`

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useSessionSync } from "../useSessionSync";
import * as SocketContext from "@/contexts/SocketContext";
import { useLiveKit } from "@/hooks/useLiveKit";

// Mock dependencies
jest.mock("@/contexts/SocketContext");
jest.mock("@/contexts/BookingContext");
jest.mock("@/hooks/useLiveKit");
jest.mock("@/hooks/useToast");

describe("useSessionSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe("sync() function", () => {
    it("should successfully sync session", async () => {
      // Arrange
      const mockResponse = {
        token: "test-token",
        room_name: "test-room",
        livekit_url: "https://livekit.example.com",
      };

      const mockInitializeLiveKit = jest.fn();
      (useLiveKit as jest.Mock).mockReturnValue({
        config: null,
        initializeLiveKit: mockInitializeLiveKit,
        clearLiveKit: jest.fn(),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const onSuccess = jest.fn();

      // Act
      const { result } = renderHook(() => useSessionSync({ onSuccess }));

      await result.current.sync();

      // Assert
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockResponse);
      });
    });

    it("should handle 403 Forbidden (expired)", async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const onExpired = jest.fn();

      // Act
      const { result } = renderHook(() => useSessionSync({ onExpired }));

      await result.current.sync();

      // Assert
      await waitFor(() => {
        expect(onExpired).toHaveBeenCalled();
      });
    });

    it("should handle 410 Gone (initialization window expired)", async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 410,
      });

      const onExpired = jest.fn();

      // Act
      const { result } = renderHook(() => useSessionSync({ onExpired }));

      await result.current.sync();

      // Assert
      await waitFor(() => {
        expect(onExpired).toHaveBeenCalled();
      });
    });

    it("should handle network errors", async () => {
      // Arrange
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const onError = jest.fn();

      // Act
      const { result } = renderHook(() => useSessionSync({ onError }));

      await result.current.sync();

      // Assert
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it("should not run sync twice simultaneously", async () => {
      // Arrange
      let resolveSync: any;
      const syncPromise = new Promise((resolve) => {
        resolveSync = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce({
        ok: true,
        status: 200,
        json: () => syncPromise,
      });

      const onSuccess = jest.fn();

      // Act
      const { result } = renderHook(() => useSessionSync({ onSuccess }));

      result.current.sync();
      result.current.sync(); // Call again immediately

      resolveSync({
        token: "test-token",
        room_name: "test-room",
        livekit_url: "https://livekit.example.com",
      });

      await waitFor(() => {
        // Should only call fetch once
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("socket reconnect listener", () => {
    it("should auto-sync on socket reconnect", async () => {
      // Arrange
      const mockSocket = {
        on: jest.fn(),
        off: jest.fn(),
      };

      (SocketContext.useSocket as jest.Mock).mockReturnValue({
        socket: mockSocket,
        isConnected: true,
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "test-token",
          room_name: "test-room",
          livekit_url: "https://livekit.example.com",
        }),
      });

      const onSuccess = jest.fn();

      // Act
      renderHook(() => useSessionSync({ onSuccess, autoReconnect: true }));

      // Simulate socket reconnect
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect",
      )?.[1];

      connectHandler?.();

      // Assert
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it("should not auto-sync if autoReconnect is false", async () => {
      // Arrange
      const mockSocket = {
        on: jest.fn(),
        off: jest.fn(),
      };

      (SocketContext.useSocket as jest.Mock).mockReturnValue({
        socket: mockSocket,
      });

      // Act
      renderHook(() => useSessionSync({ autoReconnect: false }));

      // Assert
      expect(mockSocket.on).not.toHaveBeenCalledWith(
        "connect",
        expect.any(Function),
      );
    });
  });
});
```

---

## Test Pattern 2: SessionVideoComponent

### File: `src/components/__tests__/SessionVideoComponent.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionVideoComponent } from '../SessionVideoComponent';
import * as useSessionSyncHook from '@/hooks/useSessionSync';

// Mock dependencies
jest.mock('@/hooks/useSessionSync');
jest.mock('@/hooks/useLiveKit');
jest.mock('@livekit/components-react', () => ({
  LiveKitRoom: ({ children, onConnected, onError }: any) => (
    <div data-testid="livekit-room">
      <button onClick={onConnected}>Simulate Connected</button>
      {children}
    </div>
  ),
  VideoConference: () => <div data-testid="video-conference" />,
}));
jest.mock('@/hooks/useToast');

describe('SessionVideoComponent', () => {
  const mockProps = {
    bookingId: 'booking-123',
    sessionId: 'session-456',
    initialToken: 'token-123',
    initialRoomName: 'room-abc',
    liveKitUrl: 'https://livekit.example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    // Arrange
    (useSessionSyncHook.useSessionSync as jest.Mock).mockReturnValue({
      sync: jest.fn(),
    });

    // Act
    render(<SessionVideoComponent {...mockProps} />);

    // Assert - component renders but waits for effect
    expect(screen.getByText(/Connecting to session/i)).toBeInTheDocument();
  });

  it('should render video after loading', async () => {
    // Arrange
    (useSessionSyncHook.useSessionSync as jest.Mock).mockReturnValue({
      sync: jest.fn(),
    });

    // Act
    render(<SessionVideoComponent {...mockProps} />);

    // Wait for component to be ready
    await waitFor(() => {
      expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
    });

    // Assert
    expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
    expect(screen.getByTestId('video-conference')).toBeInTheDocument();
  });

  it('should show reconnect button', async () => {
    // Arrange
    (useSessionSyncHook.useSessionSync as jest.Mock).mockReturnValue({
      sync: jest.fn(),
    });

    // Act
    render(<SessionVideoComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
    });

    // Assert
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });

  it('should call sync on reconnect button click', async () => {
    // Arrange
    const mockSync = jest.fn();
    (useSessionSyncHook.useSessionSync as jest.Mock).mockReturnValue({
      sync: mockSync,
    });

    // Act
    render(<SessionVideoComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
    });

    const reconnectButton = screen.getByRole('button', { name: /reconnect/i });
    fireEvent.click(reconnectButton);

    // Assert
    expect(mockSync).toHaveBeenCalled();
  });

  it('should update token on sync success', async () => {
    // Arrange
    let syncCallback: any;
    (useSessionSyncHook.useSessionSync as jest.Mock).mockImplementation(
      ({ onSuccess }: any) => {
        syncCallback = onSuccess;
        return { sync: jest.fn() };
      }
    );

    // Act
    render(<SessionVideoComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
    });

    const newData = {
      token: 'new-token-123',
      room_name: 'new-room',
      livekit_url: 'https://livekit.example.com',
    };

    syncCallback(newData);

    // Assert - component should be re-rendering with new token
    await waitFor(() => {
      expect(screen.getByTestId('livekit-room')).toBeInTheDocument();
    });
  });
});
```

---

## Test Pattern 3: Session Page

### File: `src/pages/session/__tests__/[bookingId][sessionId].test.tsx`

```typescript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import SessionPage from '../[bookingId]/[sessionId]';

// Mock Next.js router
jest.mock('next/router');

// Mock components
jest.mock('@/components/SessionVideoComponent', () => ({
  SessionVideoComponent: ({ bookingId, sessionId }: any) => (
    <div data-testid="session-video">
      {bookingId} - {sessionId}
    </div>
  ),
}));

jest.mock('@/hooks/useToast');

describe('SessionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('should show loading state initially', () => {
    // Arrange
    const mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      query: { bookingId: 'booking-123', sessionId: 'session-456' },
      push: mockPush,
    });

    // Act
    render(<SessionPage />);

    // Assert
    expect(screen.getByText(/Initializing session/i)).toBeInTheDocument();
  });

  it('should accept session on mount', async () => {
    // Arrange
    const mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      query: { bookingId: 'booking-123', sessionId: 'session-456' },
      push: mockPush,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: 'test-token',
        room_name: 'test-room',
        livekit_url: 'https://livekit.example.com',
      }),
    });

    // Act
    render(<SessionPage />);

    // Assert
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/accept'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-video')).toBeInTheDocument();
    });
  });

  it('should handle 410 Gone (initialization window expired)', async () => {
    // Arrange
    const mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      query: { bookingId: 'booking-123', sessionId: 'session-456' },
      push: mockPush,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 410,
    });

    // Act
    render(<SessionPage />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Session window expired/i)).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /Back to Dashboard/i });
    expect(backButton).toBeInTheDocument();
  });

  it('should handle 400 Bad Request', async () => {
    // Arrange
    const mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      query: { bookingId: 'booking-123', sessionId: 'session-456' },
      push: mockPush,
    });

    // First fetch returns 400, so page calls getSessionToken
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: 'test-token',
          room_name: 'test-room',
          livekit_url: 'https://livekit.example.com',
        }),
      });

    // Act
    render(<SessionPage />);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('session-video')).toBeInTheDocument();
    });
  });

  it('should handle network errors', async () => {
    // Arrange
    const mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({
      query: { bookingId: 'booking-123', sessionId: 'session-456' },
      push: mockPush,
    });

    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    // Act
    render(<SessionPage />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Session Error/i)).toBeInTheDocument();
    });
  });
});
```

---

## Test Pattern 4: Integration Test

### File: `src/__tests__/session-sync.integration.test.ts`

End-to-end test simulating real user flow:

```typescript
import { setupServer } from "msw";
import { rest } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { useSessionSync } from "@/hooks/useSessionSync";

// Setup Mock Service Worker
const server = setupServer(
  rest.post(
    "/api/v1/bookings/:bookingId/sessions/:sessionId/accept",
    (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          token: "mock-token",
          room_name: "mock-room",
          livekit_url: "https://livekit.example.com",
        }),
      );
    },
  ),

  rest.get("/api/v1/bookings/:bookingId/sync", (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        token: "synced-token",
        room_name: "synced-room",
        livekit_url: "https://livekit.example.com",
      }),
    );
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Session Sync Integration", () => {
  it("should complete happy path flow", async () => {
    // Arrange
    const onSuccess = jest.fn();
    const onExpired = jest.fn();

    // Act 1: Initial accept
    const response1 = await fetch(
      "/api/v1/bookings/booking-123/sessions/session-456/accept",
      { method: "POST" },
    );
    const data1 = await response1.json();

    // Assert accept
    expect(data1.token).toBe("mock-token");

    // Act 2: Sync after reconnection
    const response2 = await fetch("/api/v1/bookings/booking-123/sync");
    const data2 = await response2.json();

    // Assert sync
    expect(data2.token).toBe("synced-token");
  });

  it("should handle session expiration flow", async () => {
    // Arrange
    server.use(
      rest.get("/api/v1/bookings/:bookingId/sync", (req, res, ctx) => {
        return res(ctx.status(403));
      }),
    );

    // Act
    const response = await fetch("/api/v1/bookings/booking-123/sync");

    // Assert
    expect(response.status).toBe(403);
  });
});
```

---

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm test -- --watch
```

### Run specific test file

```bash
npm test -- src/hooks/__tests__/useSessionSync.test.ts
```

### Generate coverage report

```bash
npm test -- --coverage
```

---

## Coverage Goals

Aim for these coverage targets:

```
Statements: > 80%
Branches: > 75%
Functions: > 80%
Lines: > 80%
```

---

## Test Checklist

Before submitting code:

- [ ] All tests pass: `npm test`
- [ ] No console errors
- [ ] Coverage above targets
- [ ] Edge cases covered (errors, timeouts, concurrent calls)
- [ ] Mock dependencies properly isolated
- [ ] Integration tests pass

---

## Common Test Patterns

### Testing async code

```typescript
it("should handle async operations", async () => {
  // Use async/await
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

### Testing hooks

```typescript
it("should work with hook", () => {
  const { result } = renderHook(() => useMyHook());
  expect(result.current.value).toBeDefined();
});
```

### Mocking fetch

```typescript
(global.fetch as jest.Mock).mockResolvedValueOnce({
  ok: true,
  status: 200,
  json: async () => ({ data: "test" }),
});
```

### Testing user interactions

```typescript
import userEvent from '@testing-library/user-event';

it('should respond to click', async () => {
  const user = userEvent.setup();
  render(<Button onClick={onClick} />);
  await user.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalled();
});
```

---

## Debugging Tests

### See test output in detail

```bash
npm test -- --verbose
```

### Debug a single test

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

### Print debug info

```typescript
import { render, screen, debug } from '@testing-library/react';

render(<Component />);
debug(); // Prints DOM tree
```

---

## Next Steps

- [ ] Write tests for your specific use cases
- [ ] Achieve 80%+ coverage
- [ ] Add tests to CI/CD pipeline
- [ ] Review test coverage regularly

---

**Questions?** See `TROUBLESHOOTING.md`
