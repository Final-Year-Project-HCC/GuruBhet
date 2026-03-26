# 🎥 Frontend Documentation - Session Sync Architecture

**For:** Frontend Developers (React/Next.js)  
**Related Backend Docs:** `/Users/ujjalshrestha/Desktop/GuruBhet/backend/docs/03-video-sessions/`

---

## 📚 Documentation Structure

```
Frontend/docs/session-sync/
├── INDEX.md                       ← Complete navigation index
├── 00-START-HERE.md               ← Begin here (10 min)
├── ARCHITECTURE-OVERVIEW.md        ← How it works (15 min)
├── IMPLEMENTATION-GUIDE.md         ← Step-by-step (2-3 hours)
├── ERROR-HANDLING.md              ← Error scenarios (15 min)
├── TESTING-GUIDE.md               ← Unit tests (20 min)
├── CODE-EXAMPLES.md               ← Copy-paste code (15 min)
└── TROUBLESHOOTING.md             ← Debug issues (10 min)
```

**New in this update:** Comprehensive guides for implementation, testing, error handling, and troubleshooting. See `INDEX.md` for complete navigation.

---

## 🎯 Quick Navigation

**→ See `INDEX.md` for complete navigation guide and learning paths**

### I'm Starting Fresh

1. Read: `00-START-HERE.md` (10 min)
2. Read: `ARCHITECTURE-OVERVIEW.md` (15 min)
3. Follow: `IMPLEMENTATION-GUIDE.md` (2-3 hours)

### I Need to Implement Now

1. Follow: `IMPLEMENTATION-GUIDE.md` (step-by-step)
2. Reference: `CODE-EXAMPLES.md` (copy-paste code)
3. Check: `ERROR-HANDLING.md` (error scenarios)

### I Need Code Examples

→ Go To: `CODE-EXAMPLES.md`  
→ Sections: useSessionSync hook, SessionVideoComponent, Session page, context providers

### Something's Broken

1. Check: `TROUBLESHOOTING.md` (10 min, most issues covered)
2. Reference: `ERROR-HANDLING.md` (error codes and meanings)
3. Verify: `CODE-EXAMPLES.md` (check your code matches)

### I Need to Write Tests

1. Read: `TESTING-GUIDE.md` (setup and patterns)
2. Copy from: `CODE-EXAMPLES.md` (test examples)

---

## 📋 Files Overview

| File                       | Purpose                           | Read Time |
| -------------------------- | --------------------------------- | --------- |
| `00-START-HERE.md`         | Quick overview & navigation       | 10 min    |
| `ARCHITECTURE-OVERVIEW.md` | How frontend connects to backend  | 15 min    |
| `HOOKS-GUIDE.md`           | useSessionSync hook documentation | 20 min    |
| `COMPONENTS-GUIDE.md`      | Components & composition          | 20 min    |
| `IMPLEMENTATION-GUIDE.md`  | Step-by-step implementation       | 30 min    |
| `ERROR-HANDLING.md`        | Error scenarios & solutions       | 15 min    |
| `TESTING-GUIDE.md`         | Unit & E2E testing                | 20 min    |
| `CODE-EXAMPLES.md`         | Ready-to-use code snippets        | 15 min    |
| `TROUBLESHOOTING.md`       | Common issues & debug tips        | 10 min    |

---

## 🏗️ Architecture at a Glance

```
Frontend Flow:

User navigates to session page
    ↓
useSessionSync hook activates
    ↓
POST /accept endpoint called
    ├─ Success: Get token + room_name
    └─ Error: Show error or fallback
    ↓
<SessionVideoComponent> renders
    ├─ LiveKit connection with token
    └─ Show "Reconnect" button
    ↓
Network glitch occurs
    ├─ Socket.IO disconnect
    └─ UI shows "Reconnecting..."
    ↓
Network recovers
    ├─ Socket.IO connect event
    └─ useSessionSync auto-calls GET /sync
    ↓
GET /sync endpoint returns
    ├─ Fresh token retrieved
    └─ LiveKit reinitializes
    ↓
Session continues seamlessly
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- Next.js 13+
- React 18+
- TypeScript 4.9+
- LiveKit JavaScript SDK
- Socket.IO Client

### Installation

```bash
# Install dependencies (if not already installed)
npm install @livekit/components-react livekit-client socket.io-client

# Create hook file
touch src/hooks/useSessionSync.ts

# Create components
touch src/components/SessionVideoComponent.tsx

# Create session page
touch src/pages/session/[bookingId]/[sessionId].tsx
```

### Quick Start (5 minutes)

1. Create `useSessionSync.ts` hook (130 lines)
2. Create `SessionVideoComponent.tsx` component (130 lines)
3. Create session page with `/accept` call (160 lines)
4. Test the flow

**Total:** ~420 lines of code

---

## 📊 Key Concepts

### Session Sync Hook

Handles Socket.IO reconnection and automatic sync:

- Listens for `socket.on('connect')` event
- Auto-calls `/sync` endpoint on reconnect
- Handles errors (410 Gone, 403 Forbidden)
- Provides `sync()` function for manual reconnect

### Session Video Component

Wraps LiveKit room with token refresh:

- Initializes with token from `/accept`
- Updates token from sync endpoint
- Shows loading/error states
- Provides "🔄 Reconnect" button

### Session Page

Entry point for video session:

- Calls POST `/accept` on mount
- Handles 410 error (window expired)
- Renders video component
- Manages loading states

---

## ✨ Features

✅ **Auto-Reconnection** — Network glitches handled transparently  
✅ **Token Refresh** — Fresh credentials when needed  
✅ **Error Handling** — Clear messages for expired sessions  
✅ **Loading States** — User knows what's happening  
✅ **Type Safety** — Full TypeScript support  
✅ **Testable** — Examples provided

---

## 🔄 Typical Flow

```
Time: T0
├─ User: Click "Join Session"
├─ Page: /session/[bookingId]/[sessionId] loads
├─ Code: useSessionSync hook initializes
└─ Code: Socket.IO connects

Time: T0 + 100ms
├─ Code: POST /accept called
├─ Server: Creates room, returns token
└─ UI: <SessionVideoComponent> renders with token

Time: T0 + 2s
├─ LiveKit: Connected to room
├─ UI: Video stream visible
└─ Code: Show "🔄 Reconnect" button

Time: T0 + 45min (network glitch)
├─ Network: WiFi drops
├─ Socket.IO: disconnect event
├─ UI: Show "Reconnecting..." toast
└─ LiveKit: Stream pauses

Time: T0 + 48min (network recovered)
├─ Network: WiFi reconnected
├─ Socket.IO: connect event fires
├─ Hook: useSessionSync detects reconnect
├─ API: GET /sync called
├─ Server: Returns fresh token
├─ Component: Update token state
├─ LiveKit: Reconnect with new token
├─ UI: Dismiss "Reconnecting..." toast
└─ Video: Resume streaming

Time: T0 + 65min (session should end)
├─ Session: Ends (60-min session + 4-min leniency)
└─ Teacher: POST /sessions/{id}/complete
```

---

## 🛠️ Tech Stack

**Framework & Libraries:**

- Next.js 13+ (App Router or Pages Router)
- React 18+
- TypeScript 4.9+
- TailwindCSS (styling)

**LiveKit:**

- @livekit/components-react
- livekit-client

**Communication:**

- Socket.IO Client
- Fetch API or Axios

**State Management:**

- React Context (or Zustand/Redux if needed)

**Testing:**

- Jest
- React Testing Library
- Playwright (E2E)

---

## 📖 Next Steps

1. **Start:** Open `00-START-HERE.md`
2. **Understand:** Read `ARCHITECTURE-OVERVIEW.md`
3. **Implement:** Follow `IMPLEMENTATION-GUIDE.md`
4. **Code:** Copy from `CODE-EXAMPLES.md`
5. **Test:** Use `TESTING-GUIDE.md`
6. **Debug:** Check `TROUBLESHOOTING.md` if needed

---

## 📞 Related Documentation

**Backend Implementation:**  
→ `/Users/ujjalshrestha/Desktop/GuruBhet/backend/docs/03-video-sessions/`

**Quick Reference:**  
→ `QUICK_REFERENCE.md` (in backend docs)

---

## ✅ Checklist

- [ ] Read this README
- [ ] Open `00-START-HERE.md`
- [ ] Understand architecture
- [ ] Review hook & component guides
- [ ] Follow implementation guide
- [ ] Copy code examples
- [ ] Test your implementation
- [ ] Handle errors properly
- [ ] Deploy to staging
- [ ] Test in production

---

**Let's build resilient sessions!** 🚀
